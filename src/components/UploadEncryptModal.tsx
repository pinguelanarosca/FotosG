import { useEffect, useState } from 'react';
import { Lock, Sparkles, X } from 'lucide-react';
import type { ContentCluster, GoogleAccount } from '../types/vault';

interface UploadEncryptModalProps {
  isOpen: boolean;
  accounts: GoogleAccount[];
  onClose: () => void;
  onUploadAndEncrypt: (payload: {
    file: File;
    title: string;
    accountId: string;
    cluster: Exclude<ContentCluster, 'all'>;
    location: string;
    tags: string[];
    isNsfw18Plus: boolean;
  }) => Promise<void>;
}

export function UploadEncryptModal({
  isOpen,
  accounts,
  onClose,
  onUploadAndEncrypt,
}: UploadEncryptModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 'local-vault');
  const [cluster, setCluster] = useState<Exclude<ContentCluster, 'all'>>('ar_livre');
  const [location, setLocation] = useState('São Paulo, SP');
  const [tagsText, setTagsText] = useState('backup, cofre');
  const [isNsfw18Plus, setIsNsfw18Plus] = useState(false);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accounts.length > 0 && (!accountId || accountId === 'local-vault')) {
      setAccountId(accounts[0].id);
    } else if (accounts.length === 0 && accountId !== 'local-vault') {
      setAccountId('local-vault');
    }
  }, [accounts, accountId]);

  if (!isOpen) return null;

  const handleFileChange = async (selected: File | null) => {
    setFile(selected);
    setError(null);
    if (!selected) return;
    setTitle(selected.name.replace(/\.[^.]+$/, ''));

    if (selected.type.startsWith('image/') && selected.size <= 4 * 1024 * 1024) {
      setIsAnalyzingAi(true);
      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = String(reader.result ?? '');
            const idx = res.indexOf(',');
            resolve(idx >= 0 ? res.slice(idx + 1) : res);
          };
          reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
          reader.readAsDataURL(selected);
        });

        const resp = await fetch('/api/analyze-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data,
            mimeType: selected.type,
            fileName: selected.name,
          }),
        });
        if (resp.ok) {
          const data = (await resp.json()) as {
            title?: string;
            cluster?: Exclude<ContentCluster, 'all'>;
            tags?: string[];
            isNsfw18Plus?: boolean;
            locationGuess?: string;
          };
          if (data.title) setTitle(data.title);
          if (
            data.cluster &&
            ['festas', 'ar_livre', 'viagens', 'familia', 'nsfw_18'].includes(data.cluster)
          ) {
            setCluster(data.cluster);
          }
          if (Array.isArray(data.tags) && data.tags.length > 0) {
            setTagsText(data.tags.join(', '));
          }
          if (typeof data.isNsfw18Plus === 'boolean') {
            setIsNsfw18Plus(data.isNsfw18Plus);
          }
          if (data.locationGuess) {
            setLocation(data.locationGuess);
          }
        }
      } catch {
        // Keep manual inputs editable if Gemini analysis is unavailable
      } finally {
        setIsAnalyzingAi(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Selecione uma foto ou vídeo para criptografar e enviar.');
      return;
    }
    if (title.trim().length < 2) {
      setError('Informe um título para a mídia.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onUploadAndEncrypt({
        file,
        title: title.trim(),
        accountId: accountId || accounts[0]?.id || 'local-vault',
        cluster: isNsfw18Plus ? 'nsfw_18' : cluster,
        location: location.trim() || 'Local não informado',
        tags: tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        isNsfw18Plus,
      });
      setFile(null);
      setTitle('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criptografar mídia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="upload-modal-title"
              className="font-display text-lg font-bold text-slate-950 dark:text-slate-50"
            >
              Enviar e Criptografar Mídia (AES-256-GCM)
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Criptografia realizada no navegador antes da sincronização na nuvem.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar envio de mídia"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="upload-file-input"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Selecionar foto ou vídeo
            </label>
            <input
              id="upload-file-input"
              type="file"
              accept="image/*,video/*"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
            {isAnalyzingAi && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Classificando conteúdo e detectando segurança 18+ via Gemini...</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="upload-title"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Título
              </label>
              <input
                id="upload-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome descritivo..."
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="upload-account"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Conta Google de destino
              </label>
              <select
                id="upload-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {accounts.length === 0 ? (
                  <option value="local-vault">Cofre Local (sem conta Google vinculada)</option>
                ) : (
                  accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.profileLabel} ({acc.email})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="upload-cluster"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Agrupamento de conteúdo
              </label>
              <select
                id="upload-cluster"
                value={cluster}
                onChange={(e) =>
                  setCluster(e.target.value as Exclude<ContentCluster, 'all'>)
                }
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ar_livre">Ar Livre & Trilhas</option>
                <option value="festas">Festas & Eventos</option>
                <option value="viagens">Viagens</option>
                <option value="familia">Família</option>
                <option value="nsfw_18">Conteúdo 18+ NSFW</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="upload-location"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Localização
              </label>
              <input
                id="upload-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="upload-tags"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Tags separadas por vírgula
            </label>
            <input
              id="upload-tags"
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isNsfw18Plus}
              onChange={(e) => setIsNsfw18Plus(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <span>Marcar como Conteúdo Adulto 18+ (NSFW) com desfoque automático</span>
          </label>

          {error && (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Criptografando...' : 'Criptografar e Salvar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
