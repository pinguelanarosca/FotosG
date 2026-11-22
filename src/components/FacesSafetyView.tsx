import { Lock, Search, ShieldAlert, Unlock } from 'lucide-react';
import type { FaceCluster, SafetyShieldState } from '../types/vault';

interface FacesSafetyViewProps {
  faces: FaceCluster[];
  safety: SafetyShieldState;
  onToggleFaceSafetyLock: (faceId: string) => void;
  onToggleFaceHideInShared: (faceId: string) => void;
  onFilterGalleryByFace: (faceId: string) => void;
  onRequestUnlockSafety: () => void;
  onLockSafety: () => void;
}

export function FacesSafetyView({
  faces,
  safety,
  onToggleFaceSafetyLock,
  onToggleFaceHideInShared,
  onFilterGalleryByFace,
  onRequestUnlockSafety,
  onLockSafety,
}: FacesSafetyViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950 text-balance dark:text-slate-50">
            Reconhecimento Facial e Filtros de Segurança
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Controle quais pessoas exigem autenticação biométrica/PIN para exibição e bloqueie a
            inclusão automática em links compartilhados.
          </p>
        </div>

        <button
          type="button"
          onClick={safety.nsfwUnlocked || safety.facesUnlocked ? onLockSafety : onRequestUnlockSafety}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          {safety.nsfwUnlocked || safety.facesUnlocked ? (
            <>
              <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Ativar Bloqueio de Sessão</span>
            </>
          ) : (
            <>
              <Unlock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Desbloquear Rostos Protegidos</span>
            </>
          )}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <p className="font-medium text-slate-950 dark:text-slate-100">
              Filtro de segurança por reconhecimento facial local
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Ao ativar o bloqueio de segurança para uma pessoa, qualquer foto ou vídeo contendo seu
              rosto é desfocado automaticamente no painel até o desbloqueio da sessão.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {faces.map((face) => (
          <article
            key={face.id}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="flex items-center gap-4">
                <img
                  src={face.avatarUrl}
                  alt={`Retrato de ${face.name}`}
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                />
                <div className="min-w-0">
                  <h2 className="font-display text-base font-semibold text-slate-950 truncate dark:text-slate-100">
                    {face.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {face.relation} ·{' '}
                    <span className="font-mono tabular-nums">{face.photoCount}</span> mídias ·{' '}
                    <span className="font-mono tabular-nums">
                      {Math.round(face.confidenceAvg * 100)}%
                    </span>{' '}
                    precisão
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">
                    Bloqueio de segurança facial
                  </span>
                  <input
                    type="checkbox"
                    checked={face.safetyLock}
                    onChange={() => onToggleFaceSafetyLock(face.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">
                    Ocultar em compartilhamentos
                  </span>
                  <input
                    type="checkbox"
                    checked={face.hideInShared}
                    onChange={() => onToggleFaceHideInShared(face.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onFilterGalleryByFace(face.id)}
              className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Ver mídias de {face.name}</span>
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
