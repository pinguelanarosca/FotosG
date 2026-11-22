import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import type { GoogleContactSuggestion } from '../services/googleAuth';
import type { MediaItem, SharePermissions, ShareRule } from '../types/vault';
import { validateShareRuleInput } from '../utils/mediaFilters';

interface ShareModalProps {
  media: MediaItem | null;
  contacts: GoogleContactSuggestion[];
  onClose: () => void;
  onCreateShare: (rule: Omit<ShareRule, 'id' | 'createdAt' | 'expiresAt' | 'shareToken' | 'encryptedKeyFragment' | 'revoked'>) => void;
}

export function ShareModal({ media, contacts, onClose, onCreateShare }: ShareModalProps) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [relationship, setRelationship] = useState<'Amigo' | 'Família' | 'Convidado'>('Família');
  const [permissions, setPermissions] = useState<SharePermissions>({
    canView: true,
    canDownload: false,
    stripExifLocation: true,
    requireE2eePasscode: true,
    expiresInDays: 7,
  });
  const [error, setError] = useState<string | null>(null);

  if (!media) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateShareRuleInput({
      recipientName,
      recipientEmail,
      permissions,
    });
    if (!check.valid) {
      setError(check.error ?? 'Dados inválidos.');
      return;
    }

    onCreateShare({
      mediaId: media.id,
      mediaTitle: media.title,
      recipientName: recipientName.trim(),
      recipientEmail: recipientEmail.trim(),
      relationship,
      permissions,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="share-modal-title"
              className="font-display text-lg font-bold text-slate-950 dark:text-slate-50"
            >
              Compartilhamento Seletivo E2EE
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Item: <span className="font-medium text-slate-900 dark:text-slate-100">{media.title}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de compartilhamento"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {contacts.length > 0 && (
          <div className="mt-4">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Sugestões dos seus contatos Google:
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {contacts.slice(0, 5).map((contact) => (
                <button
                  key={contact.email}
                  type="button"
                  onClick={() => {
                    setRecipientName(contact.name);
                    setRecipientEmail(contact.email);
                    setError(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {contact.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="share-recipient-name"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Nome do destinatário
              </label>
              <input
                id="share-recipient-name"
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Ex.: Ana Clara"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="share-recipient-email"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                E-mail Google
              </label>
              <input
                id="share-recipient-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="amigo@gmail.com"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="share-relationship"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Grupo / Vínculo
              </label>
              <select
                id="share-relationship"
                value={relationship}
                onChange={(e) =>
                  setRelationship(e.target.value as 'Amigo' | 'Família' | 'Convidado')
                }
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="Família">Família</option>
                <option value="Amigo">Amigo</option>
                <option value="Convidado">Convidado</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="share-expiry-days"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Validade (dias)
              </label>
              <input
                id="share-expiry-days"
                type="number"
                min={1}
                max={365}
                value={permissions.expiresInDays}
                onChange={(e) =>
                  setPermissions((prev) => ({
                    ...prev,
                    expiresInDays: Number(e.target.value) || 7,
                  }))
                }
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
            <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
              Permissões personalizadas
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={permissions.canView}
                onChange={(e) =>
                  setPermissions((prev) => ({ ...prev, canView: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Permitir visualização em alta resolução</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={permissions.canDownload}
                onChange={(e) =>
                  setPermissions((prev) => ({ ...prev, canDownload: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Permitir download do arquivo descriptografado</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={permissions.stripExifLocation}
                onChange={(e) =>
                  setPermissions((prev) => ({
                    ...prev,
                    stripExifLocation: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Remover metadados EXIF e coordenadas GPS ao compartilhar</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={permissions.requireE2eePasscode}
                onChange={(e) =>
                  setPermissions((prev) => ({
                    ...prev,
                    requireE2eePasscode: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Exigir senha E2EE dedicada para abrir o link</span>
            </label>
          </div>

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
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Gerar Link Protegido</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
