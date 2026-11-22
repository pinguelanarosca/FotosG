import { useState } from 'react';
import { Check, Copy, Lock, Plus, ShieldOff, UserPlus } from 'lucide-react';
import type { MediaItem, ShareRule } from '../types/vault';

interface SharingViewProps {
  shareRules: ShareRule[];
  mediaItems: MediaItem[];
  onOpenNewShare: (media: MediaItem) => void;
  onRevokeShare: (shareId: string) => void;
}

export function SharingView({
  shareRules,
  mediaItems,
  onOpenNewShare,
  onRevokeShare,
}: SharingViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<string>(mediaItems[0]?.id ?? '');

  const handleCopy = async (rule: ShareRule) => {
    const shareUrl = `${window.location.origin}/?share=${rule.shareToken}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedId(rule.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeCount = shareRules.filter((r) => !r.revoked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950 text-balance dark:text-slate-50">
            Compartilhamento Seletivo com Amigos e Família
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
              {activeCount}
            </span>{' '}
            permissões ativas com remoção opcional de metadados EXIF/GPS e chave E2EE.
          </p>
        </div>

        {mediaItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="share-quick-media" className="sr-only">
              Escolher mídia para compartilhar
            </label>
            <select
              id="share-quick-media"
              value={selectedMediaId}
              onChange={(e) => setSelectedMediaId(e.target.value)}
              className="h-10 max-w-[240px] rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {mediaItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const media = mediaItems.find((m) => m.id === selectedMediaId) ?? mediaItems[0];
                if (media) onOpenNewShare(media);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Permissão</span>
            </button>
          </div>
        )}
      </div>

      {shareRules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900">
          <UserPlus className="h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Nenhum compartilhamento seletivo ativo
          </h2>
          <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
            Selecione uma foto ou vídeo e defina permissões individuais para amigos e familiares.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-4 py-3">Destinatário</th>
                  <th className="px-4 py-3">Mídia</th>
                  <th className="px-4 py-3">Permissões personalizadas</th>
                  <th className="px-4 py-3">Expiração</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shareRules.map((rule) => {
                  const expiresDate = new Date(rule.expiresAt).toLocaleDateString('pt-BR');
                  const permsList = [
                    rule.permissions.canView ? 'Visualizar' : null,
                    rule.permissions.canDownload ? 'Download' : 'Sem download',
                    rule.permissions.stripExifLocation ? 'Sem GPS/EXIF' : 'EXIF completo',
                    rule.permissions.requireE2eePasscode ? 'Senha E2EE' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <tr
                      key={rule.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-medium text-slate-950 dark:text-slate-100">
                          {rule.recipientName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {rule.recipientEmail} · {rule.relationship}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-medium text-slate-900 dark:text-slate-200">
                          {rule.mediaTitle}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          <Lock className="h-3 w-3" />
                          <span>{rule.encryptedKeyFragment}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top text-xs text-slate-700 dark:text-slate-300">
                        {permsList}
                      </td>
                      <td className="px-4 py-3.5 align-top font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {expiresDate}
                      </td>
                      <td className="px-4 py-3.5 align-top text-xs font-medium">
                        {rule.revoked ? (
                          <span className="text-red-600 dark:text-red-400">Revogado</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">Ativo</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={rule.revoked}
                            onClick={() => handleCopy(rule)}
                            aria-label={`Copiar link para ${rule.recipientName}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {copiedId === rule.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Link</span>
                              </>
                            )}
                          </button>

                          {!rule.revoked && (
                            <button
                              type="button"
                              onClick={() => onRevokeShare(rule.id)}
                              aria-label={`Revogar acesso de ${rule.recipientName}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/50"
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                              <span>Revogar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
