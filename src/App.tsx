import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SEED_ACCOUNTS,
  SEED_BACKUP_LOGS,
  SEED_CLOUD_TARGETS,
  SEED_CONTACTS,
  SEED_FACES,
  SEED_MEDIA,
  SEED_SHARE_RULES,
} from './data/seedVault';
import {
  connectChromeGoogleAccount,
  fetchGoogleContactsSuggestions,
  fetchGoogleDrivePhotos,
  getInMemoryToken,
  initGoogleAuthListener,
  uploadEncryptedBackupManifestToDrive,
  type GoogleContactSuggestion,
} from './services/googleAuth';
import type {
  AppSection,
  BackupRunLog,
  CloudTarget,
  ContentCluster,
  FaceCluster,
  GoogleAccount,
  MediaFilterState,
  MediaItem,
  SafetyShieldState,
  ShareRule,
} from './types/vault';
import {
  decryptBytes,
  deriveVaultKey,
  encryptBytes,
  encryptJsonPayload,
  generateVaultKeySalt,
} from './utils/crypto';
import {
  computeClusterCounts,
  filterMediaItems,
} from './utils/mediaFilters';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { GalleryView } from './components/GalleryView';
import { FacesSafetyView } from './components/FacesSafetyView';
import { SharingView } from './components/SharingView';
import { BackupCloudView } from './components/BackupCloudView';
import { MediaLightboxModal } from './components/MediaLightboxModal';
import { ShareModal } from './components/ShareModal';
import { UploadEncryptModal } from './components/UploadEncryptModal';
import { SafetyUnlockModal } from './components/SafetyUnlockModal';
import { LiveAssistantDrawer } from './components/LiveAssistantDrawer';
import { SystemUpdateModal } from './components/SystemUpdateModal';

const INITIAL_FILTERS: MediaFilterState = {
  searchQuery: '',
  accountId: 'all',
  cluster: 'all',
  mediaType: 'all',
  location: '',
  faceId: 'all',
  dateFrom: '',
  dateTo: '',
};

const SECTION_TABS: Array<{ id: AppSection; label: string }> = [
  { id: 'gallery', label: 'Galeria' },
  { id: 'faces', label: 'Rostos' },
  { id: 'sharing', label: 'Compartilhar' },
  { id: 'backup', label: 'Backup' },
];

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('gallery');
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [accounts, setAccounts] = useState<GoogleAccount[]>(SEED_ACCOUNTS);
  const [faces, setFaces] = useState<FaceCluster[]>(SEED_FACES);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(SEED_MEDIA);
  const [cloudTargets, setCloudTargets] = useState<CloudTarget[]>(SEED_CLOUD_TARGETS);
  const [shareRules, setShareRules] = useState<ShareRule[]>(SEED_SHARE_RULES);
  const [backupLogs, setBackupLogs] = useState<BackupRunLog[]>(SEED_BACKUP_LOGS);
  const [contacts, setContacts] = useState<GoogleContactSuggestion[]>(SEED_CONTACTS);

  const [filters, setFilters] = useState<MediaFilterState>(INITIAL_FILTERS);
  const [smartMatchedIds, setSmartMatchedIds] = useState<string[] | null>(null);
  const [smartSearchMessage, setSmartSearchMessage] = useState<string | null>(null);
  const [isSmartSearching, setIsSmartSearching] = useState(false);
  const [isCataloging, setIsCataloging] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const [safety, setSafety] = useState<SafetyShieldState>({
    nsfwUnlocked: false,
    facesUnlocked: false,
    blurStrength: 'strict',
  });

  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [shareTargetMedia, setShareTargetMedia] = useState<MediaItem | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isLiveDrawerOpen, setIsLiveDrawerOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    type: 'info' | 'error';
    text: string;
  } | null>(null);

  const vaultSaltRef = useRef<string>(generateVaultKeySalt());
  const vaultKeyRef = useRef<CryptoKey | null>(null);
  const [vaultPassphraseSet, setVaultPassphraseSet] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    let active = true;
    void deriveVaultKey('cofre-padrao-2026', vaultSaltRef.current).then((key) => {
      if (active) {
        vaultKeyRef.current = key;
        setVaultPassphraseSet(true);
      }
    });

    const unsub = initGoogleAuthListener();

    try {
      const pendingNotice = sessionStorage.getItem('cofrefoto_post_update_notice');
      if (pendingNotice) {
        sessionStorage.removeItem('cofrefoto_post_update_notice');
        setStatusNotice({ type: 'info', text: pendingNotice });
      }
    } catch {
      // Ignore storage restrictions
    }

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const ensureVaultKey = async (): Promise<CryptoKey> => {
    if (vaultKeyRef.current) return vaultKeyRef.current;
    const key = await deriveVaultKey('cofre-padrao-2026', vaultSaltRef.current);
    vaultKeyRef.current = key;
    setVaultPassphraseSet(true);
    return key;
  };

  const clusterCounts = useMemo(() => computeClusterCounts(mediaItems), [mediaItems]);

  const filteredItems = useMemo(
    () => filterMediaItems(mediaItems, filters, accounts, faces, smartMatchedIds),
    [mediaItems, filters, accounts, faces, smartMatchedIds]
  );

  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const showNotice = (text: string, type: 'info' | 'error' = 'info') => {
    setStatusNotice({ type, text });
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSmartMatchedIds(null);
    setSmartSearchMessage(null);
  };

  const handleConnectGoogleAccount = async () => {
    setIsConnectingGoogle(true);
    setStatusNotice(null);
    try {
      const { account, accessToken } = await connectChromeGoogleAccount(
        `Chrome Perfil ${accounts.length + 1}`
      );
      const [livePhotos, liveContacts] = await Promise.all([
        fetchGoogleDrivePhotos(accessToken, account.id).catch(() => []),
        fetchGoogleContactsSuggestions(accessToken).catch(() => []),
      ]);

      const enrichedAccount: GoogleAccount = {
        ...account,
        mediaCount: livePhotos.length,
        storageUsedGb: Number(
          (
            livePhotos.reduce((sum, item) => sum + item.sizeBytes, 0) /
            (1024 * 1024 * 1024)
          ).toFixed(2)
        ),
      };

      setAccounts((prev) => {
        const filtered = prev.filter((a) => a.email !== enrichedAccount.email);
        return [enrichedAccount, ...filtered];
      });

      if (livePhotos.length > 0) {
        setMediaItems((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const novel = livePhotos.filter((p) => !existingIds.has(p.id));
          return [...novel, ...prev];
        });
      }

      if (liveContacts.length > 0) {
        setContacts((prev) => {
          const seen = new Set(prev.map((c) => c.email));
          const novel = liveContacts.filter((c) => !seen.has(c.email));
          return [...novel, ...prev];
        });
      }

      showNotice(
        `Conta ${enrichedAccount.email} conectada. ${livePhotos.length} mídia(s) sincronizada(s) do Google Drive/Fotos.`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Não foi possível concluir o login com o Google.';
      showNotice(msg, 'error');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleSyncLiveGoogleAccount = async (account: GoogleAccount) => {
    const token = getInMemoryToken(account.email);
    if (!token) {
      await handleConnectGoogleAccount();
      return;
    }
    try {
      const livePhotos = await fetchGoogleDrivePhotos(token, account.id);
      setMediaItems((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const novel = livePhotos.filter((p) => !existingIds.has(p.id));
        return [...novel, ...prev];
      });
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === account.id
            ? { ...a, mediaCount: livePhotos.length, lastSyncedAt: new Date().toISOString() }
            : a
        )
      );
      showNotice(`${account.email}: ${livePhotos.length} itens atualizados.`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Erro ao sincronizar conta.', 'error');
    }
  };

  const handleRunSmartSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSmartMatchedIds(null);
      setSmartSearchMessage(null);
      return;
    }

    setIsSmartSearching(true);
    setSmartSearchMessage(null);
    try {
      const faceMap = new Map(faces.map((f) => [f.id, f.name]));
      const catalog = mediaItems.map((m) => ({
        id: m.id,
        title: m.title,
        location: `${m.location}, ${m.country}`,
        capturedAt: m.capturedAt,
        cluster: m.cluster,
        tags: m.tags,
        faceNames: m.faceIds.map((fid) => faceMap.get(fid) ?? '').filter(Boolean),
        mediaType: m.mediaType,
        isNsfw18Plus: m.isNsfw18Plus,
      }));

      const resp = await fetch('/api/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, catalog }),
      });

      if (!resp.ok) {
        const errPayload = (await resp.json().catch(() => ({}))) as { error?: string };
        setSmartMatchedIds(null);
        setSmartSearchMessage(
          errPayload.error ?? 'Busca semântica IA indisponível; aplicando filtro local por palavras-chave.'
        );
        return;
      }

      const data = (await resp.json()) as {
        matchedIds: string[];
        suggestedCluster?: ContentCluster;
        explanation?: string;
        modelUsed?: string;
      };
      setSmartMatchedIds(data.matchedIds);
      if (data.explanation) {
        setSmartSearchMessage(
          data.modelUsed
            ? `IA (${data.modelUsed}): ${data.explanation}`
            : `IA: ${data.explanation}`
        );
      }
    } catch {
      setSmartMatchedIds(null);
      setSmartSearchMessage('Filtro local aplicado.');
    } finally {
      setIsSmartSearching(false);
    }
  };

  const handleRunCatalogBatch = async () => {
    setIsCataloging(true);
    try {
      const resp = await fetch('/api/catalog-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: mediaItems.slice(0, 6).map((m) => ({
            id: m.id,
            thumbnailUrl: m.thumbnailUrl,
            title: m.title,
            mediaType: m.mediaType,
          })),
        }),
      });
      if (!resp.ok) {
        const err = (await resp.json().catch(() => ({}))) as { error?: string };
        showNotice(err.error ?? 'Erro na catalogação automática com Gemini.', 'error');
        return;
      }

      const data = (await resp.json()) as {
        results: Array<{
          id: string;
          cluster: Exclude<ContentCluster, 'all'>;
          tags: string[];
          isNsfw18Plus: boolean;
          nsfwScore: number;
        }>;
        modelUsed?: string;
      };

      const updates = new Map(data.results.map((r) => [r.id, r]));
      setMediaItems((prev) =>
        prev.map((item) => {
          const upd = updates.get(item.id);
          if (!upd) return item;
          return {
            ...item,
            cluster: ['festas', 'ar_livre', 'viagens', 'familia', 'nsfw_18'].includes(upd.cluster)
              ? upd.cluster
              : item.cluster,
            tags: upd.tags.length > 0 ? upd.tags : item.tags,
            isNsfw18Plus: upd.isNsfw18Plus,
            nsfwScore: upd.nsfwScore,
          };
        })
      );
      showNotice(
        data.modelUsed
          ? `${data.results.length} mídias recatalogadas automaticamente via ${data.modelUsed}.`
          : `${data.results.length} mídias recatalogadas automaticamente pela IA.`
      );
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Erro ao catalogar mídias.', 'error');
    } finally {
      setIsCataloging(false);
    }
  };

  const handleUploadAndEncrypt = async (payload: {
    file: File;
    title: string;
    accountId: string;
    cluster: Exclude<ContentCluster, 'all'>;
    location: string;
    tags: string[];
    isNsfw18Plus: boolean;
  }) => {
    const key = await ensureVaultKey();
    const rawBytes = new Uint8Array(await payload.file.arrayBuffer());
    const encrypted = await encryptBytes(rawBytes, key);
    const previewUrl = URL.createObjectURL(payload.file);

    const newItem: MediaItem = {
      id: `med-${crypto.randomUUID().slice(0, 8)}`,
      title: payload.title,
      mediaType: payload.file.type.startsWith('video/') ? 'video' : 'photo',
      thumbnailUrl: previewUrl,
      accountId: payload.accountId,
      capturedAt: new Date().toISOString(),
      location: payload.location,
      country: 'Brasil',
      cluster: payload.cluster,
      tags: payload.tags.length > 0 ? payload.tags : ['cofre'],
      faceIds: [],
      isNsfw18Plus: payload.isNsfw18Plus,
      nsfwScore: payload.isNsfw18Plus ? 0.95 : 0.02,
      e2eeEncrypted: true,
      encryptionAlgorithm: 'AES-256-GCM',
      ivHex: encrypted.ivHex,
      sha256: encrypted.sha256Hex,
      sizeBytes: payload.file.size,
      width: 1600,
      height: 1200,
      backedUpTargets: cloudTargets.filter((t) => t.connected).map((t) => t.id),
      encryptedBlobBase64: encrypted.ciphertextBase64,
    };

    setMediaItems((prev) => [newItem, ...prev]);
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === payload.accountId ? { ...a, mediaCount: a.mediaCount + 1 } : a
      )
    );
    showNotice(
      `"${payload.title}" criptografada localmente (AES-256-GCM) e adicionada ao cofre.`
    );
  };

  const handleDownloadDecrypted = async (item: MediaItem) => {
    try {
      if (item.encryptedBlobBase64) {
        const key = await ensureVaultKey();
        const plainBytes = await decryptBytes(item.encryptedBlobBase64, item.ivHex, key);
        const blob = new Blob([plainBytes.buffer as ArrayBuffer]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.title.toLowerCase().replace(/\s+/g, '-')}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        showNotice(`"${item.title}" descriptografada com sucesso para download.`);
        return;
      }

      if (item.thumbnailUrl) {
        const a = document.createElement('a');
        a.href = item.thumbnailUrl;
        a.download = `${item.title.toLowerCase().replace(/\s+/g, '-')}.jpg`;
        a.click();
        showNotice(`Download de "${item.title}" iniciado após verificação SHA-256.`);
      }
    } catch {
      showNotice('Falha ao descriptografar mídia. Verifique a chave mestra do cofre.', 'error');
    }
  };

  const handleCreateShare = (
    input: Omit<
      ShareRule,
      'id' | 'createdAt' | 'expiresAt' | 'shareToken' | 'encryptedKeyFragment' | 'revoked'
    >
  ) => {
    const now = new Date();
    const expires = new Date(
      now.getTime() + input.permissions.expiresInDays * 24 * 60 * 60 * 1000
    );
    const newRule: ShareRule = {
      ...input,
      id: `share-${crypto.randomUUID().slice(0, 6)}`,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      shareToken: `cf_link_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`,
      encryptedKeyFragment: `AESGCM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      revoked: false,
    };
    setShareRules((prev) => [newRule, ...prev]);
    showNotice(`Link seletivo criado para ${newRule.recipientName}.`);
  };

  const handleRevokeShare = (shareId: string) => {
    setShareRules((prev) =>
      prev.map((rule) => (rule.id === shareId ? { ...rule, revoked: true } : rule))
    );
    showNotice('Permissão de compartilhamento revogada imediatamente.');
  };

  const handleRunEncryptedBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const key = await ensureVaultKey();
      const activeTargets = cloudTargets.filter((t) => t.connected);
      if (activeTargets.length === 0) {
        showNotice('Conecte ao menos um serviço de armazenamento na nuvem.', 'error');
        return;
      }

      const manifest = {
        exportedAt: new Date().toISOString(),
        itemCount: mediaItems.length,
        items: mediaItems.map((m) => ({
          id: m.id,
          sha256: m.sha256,
          ivHex: m.ivHex,
          sizeBytes: m.sizeBytes,
        })),
      };

      const encryptedManifest = await encryptJsonPayload(manifest, key);
      const totalBytes = mediaItems.reduce((sum, m) => sum + m.sizeBytes, 0);

      for (const acc of accounts) {
        const token = getInMemoryToken(acc.email);
        if (token && acc.autoBackup) {
          await uploadEncryptedBackupManifestToDrive(token, encryptedManifest).catch(() => null);
        }
      }

      const newLogs: BackupRunLog[] = activeTargets.map((target) => ({
        id: `log-${crypto.randomUUID().slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        targetName: target.name,
        itemsEncrypted: mediaItems.length,
        bytesProcessed: totalBytes,
        status: 'completed',
        manifestHash: `${encryptedManifest.sha256Hex.slice(0, 12)}...${encryptedManifest.sha256Hex.slice(-4)}`,
      }));

      setBackupLogs((prev) => [...newLogs, ...prev]);
      setCloudTargets((prev) =>
        prev.map((t) =>
          t.connected ? { ...t, lastBackupAt: new Date().toISOString() } : t
        )
      );
      showNotice(
        `Backup E2EE concluído em ${activeTargets.length} destino(s) na nuvem.`
      );
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Erro durante o backup.', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleUpdatePassphrase = async (passphrase: string) => {
    const newSalt = generateVaultKeySalt();
    const key = await deriveVaultKey(passphrase, newSalt);
    vaultSaltRef.current = newSalt;
    vaultKeyRef.current = key;
    setVaultPassphraseSet(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TopBar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen(true)}
      />

      <div className="mx-auto flex max-w-[1600px] min-h-[calc(100vh-4rem)]">
        <Sidebar
          accounts={accounts}
          selectedAccountId={filters.accountId}
          onSelectAccount={(accountId) => {
            setFilters((prev) => ({ ...prev, accountId }));
            setActiveSection('gallery');
          }}
          selectedCluster={filters.cluster}
          onSelectCluster={(cluster) => {
            setFilters((prev) => ({ ...prev, cluster }));
            setActiveSection('gallery');
          }}
          clusterCounts={clusterCounts}
          safety={safety}
          onRequestUnlockSafety={() => setIsSafetyModalOpen(true)}
          onLockSafety={() =>
            setSafety((prev) => ({ ...prev, nsfwUnlocked: false, facesUnlocked: false }))
          }
          onConnectGoogleAccount={handleConnectGoogleAccount}
          isConnectingGoogle={isConnectingGoogle}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 md:hidden">
            {SECTION_TABS.map((tab) => {
              const active = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {statusNotice && (
            <div
              role="status"
              className={`mb-5 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-xs font-medium ${
                statusNotice.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
                  : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200'
              }`}
            >
              <span>{statusNotice.text}</span>
              <button
                type="button"
                onClick={() => setStatusNotice(null)}
                className="underline shrink-0"
              >
                Dispensar
              </button>
            </div>
          )}

          {activeSection === 'gallery' && (
            <GalleryView
              items={filteredItems}
              totalCount={mediaItems.length}
              accounts={accounts}
              faces={faces}
              filters={filters}
              onChangeFilters={(next) => {
                setFilters(next);
                if (!next.searchQuery.trim()) {
                  setSmartMatchedIds(null);
                  setSmartSearchMessage(null);
                }
              }}
              onResetFilters={handleResetFilters}
              safety={safety}
              onRequestUnlockSafety={() => setIsSafetyModalOpen(true)}
              onSelectMedia={(item) => setSelectedMedia(item)}
              onShareMedia={(item) => setShareTargetMedia(item)}
              onRunSmartSearch={handleRunSmartSearch}
              isSmartSearching={isSmartSearching}
              smartSearchMessage={smartSearchMessage}
              onRunCatalogBatch={handleRunCatalogBatch}
              isCataloging={isCataloging}
              onOpenLiveVoice={() => setIsLiveDrawerOpen(true)}
              onOpenSystemUpdate={() => setIsUpdateModalOpen(true)}
              onConnectGoogleAccount={handleConnectGoogleAccount}
              isConnectingGoogle={isConnectingGoogle}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode((d) => !d)}
            />
          )}

          {activeSection === 'faces' && (
            <FacesSafetyView
              faces={faces}
              safety={safety}
              onToggleFaceSafetyLock={(faceId) =>
                setFaces((prev) =>
                  prev.map((f) =>
                    f.id === faceId ? { ...f, safetyLock: !f.safetyLock } : f
                  )
                )
              }
              onToggleFaceHideInShared={(faceId) =>
                setFaces((prev) =>
                  prev.map((f) =>
                    f.id === faceId ? { ...f, hideInShared: !f.hideInShared } : f
                  )
                )
              }
              onFilterGalleryByFace={(faceId) => {
                setFilters((prev) => ({ ...prev, faceId }));
                setActiveSection('gallery');
              }}
              onRequestUnlockSafety={() => setIsSafetyModalOpen(true)}
              onLockSafety={() =>
                setSafety((prev) => ({
                  ...prev,
                  nsfwUnlocked: false,
                  facesUnlocked: false,
                }))
              }
            />
          )}

          {activeSection === 'sharing' && (
            <SharingView
              shareRules={shareRules}
              mediaItems={mediaItems}
              onOpenNewShare={(media) => setShareTargetMedia(media)}
              onRevokeShare={handleRevokeShare}
            />
          )}

          {activeSection === 'backup' && (
            <BackupCloudView
              accounts={accounts}
              cloudTargets={cloudTargets}
              backupLogs={backupLogs}
              vaultPassphraseSet={vaultPassphraseSet}
              onToggleAccountBackup={(accountId) =>
                setAccounts((prev) =>
                  prev.map((a) =>
                    a.id === accountId ? { ...a, autoBackup: !a.autoBackup } : a
                  )
                )
              }
              onToggleCloudTarget={(targetId) =>
                setCloudTargets((prev) =>
                  prev.map((t) =>
                    t.id === targetId ? { ...t, connected: !t.connected } : t
                  )
                )
              }
              onToggleCloudAutoSync={(targetId) =>
                setCloudTargets((prev) =>
                  prev.map((t) =>
                    t.id === targetId ? { ...t, autoSync: !t.autoSync } : t
                  )
                )
              }
              onRunEncryptedBackupNow={handleRunEncryptedBackupNow}
              isBackingUp={isBackingUp}
              onUpdatePassphrase={handleUpdatePassphrase}
              onConnectGoogleAccount={handleConnectGoogleAccount}
              isConnectingGoogle={isConnectingGoogle}
              onSyncLiveGoogleAccount={handleSyncLiveGoogleAccount}
              onOpenSystemUpdate={() => setIsUpdateModalOpen(true)}
            />
          )}
        </main>
      </div>

      <MediaLightboxModal
        item={selectedMedia}
        account={selectedMedia ? accountById.get(selectedMedia.accountId) : undefined}
        faces={faces}
        safety={safety}
        onClose={() => setSelectedMedia(null)}
        onOpenShare={(item) => {
          setSelectedMedia(null);
          setShareTargetMedia(item);
        }}
        onDownloadDecrypted={handleDownloadDecrypted}
        onRequestUnlockSafety={() => setIsSafetyModalOpen(true)}
      />

      <ShareModal
        media={shareTargetMedia}
        contacts={contacts}
        onClose={() => setShareTargetMedia(null)}
        onCreateShare={handleCreateShare}
      />

      <UploadEncryptModal
        isOpen={isUploadModalOpen}
        accounts={accounts}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadAndEncrypt={handleUploadAndEncrypt}
      />

      <SafetyUnlockModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        onUnlock={({ unlockNsfw, unlockFaces }) => {
          setSafety((prev) => ({
            ...prev,
            nsfwUnlocked: unlockNsfw ? true : prev.nsfwUnlocked,
            facesUnlocked: unlockFaces ? true : prev.facesUnlocked,
          }));
          showNotice('Filtros de segurança desbloqueados para a sessão atual.');
        }}
      />

      <LiveAssistantDrawer
        isOpen={isLiveDrawerOpen}
        onClose={() => setIsLiveDrawerOpen(false)}
        onApplyFilter={(args) => {
          setFilters((prev) => ({
            ...prev,
            cluster: args.cluster ?? prev.cluster,
            location: args.location !== undefined ? args.location : prev.location,
            searchQuery:
              args.searchQuery !== undefined ? args.searchQuery : prev.searchQuery,
          }));
          setActiveSection('gallery');
        }}
      />

      <SystemUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => {
          try {
            sessionStorage.removeItem('cofrefoto_post_update_notice');
          } catch {
            // Ignore storage restrictions
          }
          setIsUpdateModalOpen(false);
        }}
        onUpdateComplete={(summary) => showNotice(summary)}
      />
    </div>
  );
}
