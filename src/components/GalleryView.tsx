import { useState } from 'react';
import {
  Calendar,
  EyeOff,
  Film,
  Lock,
  MapPin,
  Mic,
  Moon,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  ContentCluster,
  FaceCluster,
  GoogleAccount,
  MediaFilterState,
  MediaItem,
  SafetyShieldState,
} from '../types/vault';
import { evaluateMediaMask, formatBytesCompact } from '../utils/mediaFilters';

interface GalleryViewProps {
  items: MediaItem[];
  totalCount: number;
  accounts: GoogleAccount[];
  faces: FaceCluster[];
  filters: MediaFilterState;
  onChangeFilters: (next: MediaFilterState) => void;
  onResetFilters: () => void;
  safety: SafetyShieldState;
  onRequestUnlockSafety: () => void;
  onSelectMedia: (item: MediaItem) => void;
  onShareMedia: (item: MediaItem) => void;
  onRunSmartSearch: (query: string) => Promise<void>;
  isSmartSearching: boolean;
  smartSearchMessage: string | null;
  onRunCatalogBatch: () => Promise<void>;
  isCataloging: boolean;
  onOpenLiveVoice: () => void;
  onOpenSystemUpdate: () => void;
  onConnectGoogleAccount: () => void;
  isConnectingGoogle: boolean;
  onOpenUploadModal: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const CLUSTER_LABEL: Record<Exclude<ContentCluster, 'all'>, string> = {
  festas: 'Festas',
  ar_livre: 'Ar Livre',
  viagens: 'Viagens',
  familia: 'Família',
  nsfw_18: '18+ NSFW',
};

export function GalleryView({
  items,
  totalCount,
  accounts,
  faces,
  filters,
  onChangeFilters,
  onResetFilters,
  safety,
  onRequestUnlockSafety,
  onSelectMedia,
  onShareMedia,
  onRunSmartSearch,
  isSmartSearching,
  smartSearchMessage,
  onRunCatalogBatch,
  isCataloging,
  onOpenLiveVoice,
  onOpenSystemUpdate,
  onConnectGoogleAccount,
  isConnectingGoogle,
  onOpenUploadModal,
  darkMode,
  onToggleDarkMode,
}: GalleryViewProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const faceMap = new Map(faces.map((f) => [f.id, f]));

  const hasActiveFilter =
    filters.searchQuery.trim() !== '' ||
    filters.accountId !== 'all' ||
    filters.cluster !== 'all' ||
    filters.mediaType !== 'all' ||
    filters.location.trim() !== '' ||
    filters.faceId !== 'all' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '';

  const uniqueLocations = Array.from(new Set(items.map((i) => i.location)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950 text-balance dark:text-slate-50">
            Painel Centralizado de Mídias
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Visualização unificada de{' '}
            <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
              {items.length}
            </span>{' '}
            de{' '}
            <span className="font-mono tabular-nums">{totalCount}</span> arquivos protegidos com
            AES-256-GCM
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenLiveVoice}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Mic className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Busca por Voz Live</span>
          </button>

          <button
            type="button"
            onClick={onRunCatalogBatch}
            disabled={isCataloging || totalCount === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>{isCataloging ? 'Catalogando...' : 'Catalogar com IA'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSystemUpdate}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 shrink-0"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <section
        aria-label="Busca inteligente e filtros"
        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRunSmartSearch(filters.searchQuery);
          }}
          className="flex flex-col gap-3 lg:flex-row"
        >
          <div className="relative flex-1">
            <label htmlFor="smart-search-input" className="sr-only">
              Busca inteligente por descrição, pessoa, local ou data
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="smart-search-input"
              type="search"
              value={filters.searchQuery}
              onChange={(e) =>
                onChangeFilters({ ...filters, searchQuery: e.target.value })
              }
              placeholder="Buscar por festas, trilhas, viagens, cidade ou data..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSmartSearching || !filters.searchQuery.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            <span>{isSmartSearching ? 'Analisando...' : 'Busca Inteligente IA'}</span>
          </button>
        </form>

        {smartSearchMessage && (
          <p className="mt-2.5 text-xs text-blue-700 dark:text-blue-400">{smartSearchMessage}</p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label
              htmlFor="filter-media-type"
              className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Tipo de mídia
            </label>
            <select
              id="filter-media-type"
              value={filters.mediaType}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  mediaType: e.target.value as MediaFilterState['mediaType'],
                })
              }
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">Fotos e vídeos</option>
              <option value="photo">Somente fotos</option>
              <option value="video">Somente vídeos</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-face"
              className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Rosto reconhecido</span>
            </label>
            <select
              id="filter-face"
              value={filters.faceId}
              onChange={(e) => onChangeFilters({ ...filters, faceId: e.target.value })}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">Todas as pessoas</option>
              {faces.map((face) => (
                <option key={face.id} value={face.id}>
                  {face.name} ({face.relation})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-location"
              className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Localização</span>
            </label>
            <input
              id="filter-location"
              type="text"
              list="vault-locations"
              value={filters.location}
              onChange={(e) => onChangeFilters({ ...filters, location: e.target.value })}
              placeholder="Cidade ou país..."
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <datalist id="vault-locations">
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>

          <div>
            <label
              htmlFor="filter-date-from"
              className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Data inicial</span>
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onChangeFilters({ ...filters, dateFrom: e.target.value })}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="filter-date-to"
              className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Data final</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="filter-date-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => onChangeFilters({ ...filters, dateTo: e.target.value })}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  aria-label="Limpar todos os filtros"
                  title="Limpar filtros"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900">
          <ShieldCheck className="h-9 w-9 text-blue-600 dark:text-blue-400" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Seu cofre está vazio
          </h2>
          <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
            Conecte uma conta Google para sincronizar suas fotos e vídeos ou envie arquivos locais
            com criptografia AES-256-GCM.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onConnectGoogleAccount}
              disabled={isConnectingGoogle}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isConnectingGoogle ? 'Conectando...' : 'Conectar conta Google'}
            </button>
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Enviar e criptografar mídia
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900">
          <Search className="h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Nenhuma mídia encontrada com estes filtros
          </h2>
          <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
            Ajuste o intervalo de datas, cidade, conta conectada ou limpe os filtros para visualizar
            todo o seu acervo criptografado.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div
          data-testid="media-grid"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {items.map((item) => {
            const mask = evaluateMediaMask(item, safety, faces);
            const account = accountMap.get(item.accountId);
            const peopleNames = item.faceIds
              .map((fid) => faceMap.get(fid)?.name)
              .filter(Boolean)
              .join(', ');
            const dateStr = new Date(item.capturedAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            const imgBroken = !item.thumbnailUrl || failedImages[item.id];

            return (
              <article
                key={item.id}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
                  {imgBroken ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 p-4 text-center dark:bg-slate-900">
                      <ShieldCheck className="h-8 w-8 text-slate-400" />
                      <span className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                        {item.title}
                      </span>
                    </div>
                  ) : mask.masked ? (
                    <img
                      src={item.thumbnailUrl}
                      alt="Mídia protegida por filtro de privacidade"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                      }
                      className="h-full w-full scale-110 object-cover blur-2xl brightness-50"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectMedia(item)}
                      aria-label={`Ampliar "${item.title}"`}
                      className="block h-full w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                        }
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </button>
                  )}

                  {!mask.masked && (
                    <>
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
                      />

                      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-xs text-white/95">
                        <span className="truncate font-medium">
                          {CLUSTER_LABEL[item.cluster]} · {item.location}
                        </span>
                        {item.mediaType === 'video' && (
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums shrink-0">
                            <Film className="h-3.5 w-3.5" />
                            {item.durationSec ?? 0}s
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {mask.masked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 p-4 text-center text-white backdrop-blur-md">
                      <EyeOff className="h-6 w-6 text-amber-400" />
                      <p className="mt-2 text-xs font-semibold">
                        {mask.reason === 'nsfw_locked'
                          ? 'Conteúdo 18+ NSFW protegido'
                          : `Bloqueio facial ativo (${mask.lockedFaceNames.join(', ')})`}
                      </p>
                      <button
                        type="button"
                        onClick={onRequestUnlockSafety}
                        className="mt-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-white"
                      >
                        Desbloquear visualização
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectMedia(item)}
                      aria-label={`Abrir "${item.title}"`}
                      className="text-left font-display text-sm font-semibold text-slate-950 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                    >
                      {item.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => onShareMedia(item)}
                      aria-label={`Compartilhar "${item.title}"`}
                      title="Compartilhamento seletivo"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono tabular-nums">{dateStr}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {account?.profileLabel ??
                        (item.accountId === 'local-vault' ? 'Cofre Local' : 'Google')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatBytesCompact(item.sizeBytes)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    <span className="truncate">
                      {peopleNames ? `Rostos: ${peopleNames}` : item.tags.slice(0, 3).join(' · ')}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-400 shrink-0">
                      <Lock className="h-3 w-3" />
                      AES-256
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
