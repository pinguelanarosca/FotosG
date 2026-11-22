import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface SafetyUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (options: { unlockNsfw: boolean; unlockFaces: boolean }) => void;
}

export function SafetyUnlockModal({ isOpen, onClose, onUnlock }: SafetyUnlockModalProps) {
  const [pin, setPin] = useState('');
  const [unlockNsfw, setUnlockNsfw] = useState(true);
  const [unlockFaces, setUnlockFaces] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim() !== '1820') {
      setError('PIN incorreto. Utilize o PIN de verificação 1820.');
      return;
    }
    if (!unlockNsfw && !unlockFaces) {
      setError('Selecione ao menos um filtro de segurança para desbloquear.');
      return;
    }
    setPin('');
    setError(null);
    onUnlock({ unlockNsfw, unlockFaces });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-unlock-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2
              id="safety-unlock-title"
              className="font-display text-lg font-bold text-slate-950 dark:text-slate-50"
            >
              Verificação 18+ e Segurança Facial
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar verificação de segurança"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          Confirme seu PIN de privacidade para remover temporariamente o desfoque de mídias 18+
          NSFW e rostos protegidos. PIN padrão de demonstração:{' '}
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">1820</span>.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="safety-pin-input"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              PIN de segurança
            </label>
            <input
              id="safety-pin-input"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Digite 1820"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={unlockNsfw}
                onChange={(e) => setUnlockNsfw(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Desbloquear Conteúdo Adulto 18+ (NSFW)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={unlockFaces}
                onChange={(e) => setUnlockFaces(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Desbloquear Rostos com Filtro Facial</span>
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
              className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-700"
            >
              Confirmar Desbloqueio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
