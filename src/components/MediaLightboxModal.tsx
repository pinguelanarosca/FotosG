import { Download, Lock, MapPin, Share2, ShieldCheck, X } from 'lucide-react';
import type { FaceCluster, GoogleAccount, MediaItem, SafetyShieldState } from '../types/vault';
import { evaluateMediaMask, formatBytesCompact } from '../utils/mediaFilters';

interface MediaLightboxModalProps {
  item: MediaItem | null;
  account?: GoogleAccount;
  faces: FaceCluster[];
  safety: SafetyShieldState;
  onClose: () => void;
  onOpenShare: (item: MediaItem) => void;
  onDownloadDecrypted: (item: MediaItem) => void;
  onRequestUnlockSafety: () => void;
}

export function MediaLightboxModal({
  item,
  account,
  faces,
  safety,
  onClose,
  onOpenShare,
  onDownloadDecrypted,
  onRequestUnlockSafety,
}: MediaLightboxModalProps) {
  if (!item) return null;

  const mask = evaluateMediaMask(item, safety, faces);
  const itemFaces = faces.filter((f) => item.faceIds.includes(f.id));
  const dateFormatted = new Date(item.capturedAt).toLocaleString('pt-BR');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 lg:flex-row">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar visualização"
          className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/75 text-white hover:bg-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative flex min-h-[260px] flex-1 items-center justify-center bg-slate-950">
          <img
            src={item.thumbnailUrl}
            alt={mask.masked ? 'Mídia protegida' : item.title}
            referrerPolicy="no-referrer"
            className={`max-h-[75vh] w-full object-contain ${
              mask.masked ? 'blur-2xl brightness-50' : ''
            }`}
          />
          {mask.masked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 p-6 text-center text-white">
              <p className="text-sm font-semibold">
                {mask.reason === 'nsfw_locked'
                  ? 'Conteúdo 18+ NSFW protegido'
                  : `Bloqueio facial ativo (${mask.lockedFaceNames.join(', ')})`}
              </p>
              <button
                type="button"
                onClick={onRequestUnlockSafety}
                className="mt-3 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-slate-100"
              >
                Desbloquear nesta sessão
              </button>
            </div>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col justify-between overflow-y-auto border-t border-slate-200 p-5 dark:border-slate-800 lg:w-84 lg:border-l lg:border-t-0">
          <div className="space-y-4">
            <div>
              <h2
                id="lightbox-title"
                className="font-display text-lg font-bold text-slate-950 pr-8 dark:text-slate-50"
              >
                {item.title}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {account?.email ?? 'Google Fotos'}
              </p>
            </div>

            <dl className="space-y-2.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">Capturado em</dt>
                <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {dateFormatted}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Localização</span>
                </dt>
                <dd className="text-right text-slate-900 dark:text-slate-100">
                  {item.location}, {item.country}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">Dimensões e tamanho</dt>
                <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {item.width}×{item.height} · {formatBytesCompact(item.sizeBytes)}
                </dd>
              </div>
              {item.cameraModel && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Dispositivo</dt>
                  <dd className="text-slate-900 dark:text-slate-100">{item.cameraModel}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">Rostos</dt>
                <dd className="text-right text-slate-900 dark:text-slate-100">
                  {itemFaces.length > 0 ? itemFaces.map((f) => f.name).join(', ') : 'Nenhum'}
                </dd>
              </div>
            </dl>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                <span>Criptografia {item.encryptionAlgorithm}</span>
              </div>
              <div className="mt-1.5 space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                <div className="truncate">IV: {item.ivHex}</div>
                <div className="truncate">SHA-256: {item.sha256}</div>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-800 dark:text-slate-200">Tags: </span>
              {item.tags.join(' · ')}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onOpenShare(item)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Share2 className="h-4 w-4" />
              <span>Compartilhamento Seletivo</span>
            </button>
            <button
              type="button"
              onClick={() => onDownloadDecrypted(item)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Download className="h-4 w-4" />
              <span>Descriptografar e Baixar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
