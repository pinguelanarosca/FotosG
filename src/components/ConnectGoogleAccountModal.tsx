import { useState } from 'react';
import { X } from 'lucide-react';

interface ConnectGoogleAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectRealAccount: (payload: {
    email: string;
    displayName: string;
    profileLabel: string;
  }) => Promise<void>;
}

export function ConnectGoogleAccountModal({
  isOpen,
  onClose,
  onConnectRealAccount,
}: ConnectGoogleAccountModalProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileLabel, setProfileLabel] = useState('Pessoal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Informe um endereço de e-mail do Google válido.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConnectRealAccount({
        email: trimmedEmail,
        displayName: displayName.trim() || trimmedEmail.split('@')[0],
        profileLabel: profileLabel.trim() || 'Pessoal',
      });
      setEmail('');
      setDisplayName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-account-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="connect-account-modal-title"
              className="font-display text-lg font-bold text-slate-950 dark:text-slate-50"
            >
              Conectar Conta Google Real
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Informe os dados da sua conta Google para centralizar no cofre (essencial em desenvolvimento local sem domínio whitelisted no Firebase).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="google-email"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              E-mail do Google
            </label>
            <input
              id="google-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@gmail.com"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="google-name"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Nome de exibição (opcional)
            </label>
            <input
              id="google-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex.: Alexandre Satiro"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="profile-label"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Rótulo do perfil no Cofre
            </label>
            <input
              id="profile-label"
              type="text"
              required
              value={profileLabel}
              onChange={(e) => setProfileLabel(e.target.value)}
              placeholder="Ex.: Pessoal, Trabalho, Família..."
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
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
              disabled={isSubmitting}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Conectando...' : 'Vincular Conta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
