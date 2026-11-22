import { useEffect, useState } from 'react';
import { CheckCircle2, DownloadCloud, RefreshCw, RotateCw, X } from 'lucide-react';
import {
  formatShortSha,
  GITHUB_UPDATE_REPO,
  type ApplyUpdateResponse,
  type UpdateStatusResponse,
} from '../utils/updater';

interface SystemUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateComplete: (summary: string) => void;
}

export function SystemUpdateModal({
  isOpen,
  onClose,
  onUpdateComplete,
}: SystemUpdateModalProps) {
  const [status, setStatus] = useState<UpdateStatusResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [confirmInstall, setConfirmInstall] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyUpdateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkUpdates = async () => {
    setIsChecking(true);
    setError(null);
    setApplyResult(null);
    setConfirmInstall(false);
    try {
      const resp = await fetch('/api/system/update-status');
      const data = (await resp.json()) as UpdateStatusResponse & { error?: string };
      if (!resp.ok) {
        throw new Error(data.error ?? 'Erro ao verificar alterações.');
      }
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar GitHub.');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void checkUpdates();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyOrRestart = async (restartOnly: boolean) => {
    setIsApplying(true);
    setError(null);
    try {
      const resp = await fetch('/api/system/apply-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'CofreFoto-Updater',
        },
        body: JSON.stringify({ restartOnly }),
      });
      const data = (await resp.json()) as ApplyUpdateResponse & { error?: string };
      if (!resp.ok) {
        throw new Error(data.error ?? 'Erro ao instalar atualização.');
      }
      const summary = restartOnly
        ? `Serviços reiniciados com sucesso (${data.restartedServices.join(', ')}).`
        : `Atualização ${formatShortSha(data.installedSha)} instalada e serviços reiniciados.`;

      if (!restartOnly) {
        try {
          sessionStorage.setItem('cofrefoto_post_update_notice', summary);
        } catch {
          // Ignore storage restrictions
        }
      }

      setApplyResult(data);
      setConfirmInstall(false);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              installedSha: data.installedSha || prev.installedSha,
              hasUpdate: false,
            }
          : prev
      );
      onUpdateComplete(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aplicar atualização.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-update-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="system-update-title"
              className="font-display text-lg font-bold text-slate-950 dark:text-slate-50"
            >
              Atualizar Sistema ({GITHUB_UPDATE_REPO})
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Verifica alterações no repositório remoto, instala pacotes atualizados e reinicia os
              serviços da aplicação.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar atualização do sistema"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950">
            {isChecking ? (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                <span>Verificando alterações em {GITHUB_UPDATE_REPO}...</span>
              </div>
            ) : status ? (
              <dl className="space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Repositório</dt>
                  <dd className="font-mono text-slate-900 dark:text-slate-100">
                    {status.repo} ({status.branch})
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Versão instalada</dt>
                  <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {formatShortSha(status.installedSha)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Último commit remoto</dt>
                  <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {formatShortSha(status.latestSha)} ·{' '}
                    {new Date(status.latestAuthorDate).toLocaleString('pt-BR')}
                  </dd>
                </div>
                <div className="border-t border-slate-200 pt-2 dark:border-slate-800">
                  <dt className="text-slate-500 dark:text-slate-400">Resumo da alteração</dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                    {status.latestMessage}
                  </dd>
                </div>
                <div className="pt-1 font-medium">
                  {status.hasUpdate ? (
                    <span className="text-amber-700 dark:text-amber-400">
                      Alteração encontrada no GitHub pronta para instalação.
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Nenhuma alteração pendente — sistema sincronizado.</span>
                    </span>
                  )}
                </div>
              </dl>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                Clique em Verificar alterações para consultar o repositório.
              </p>
            )}
          </div>

          {applyResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <div className="font-semibold">
                Serviços reiniciados após atualização ({formatShortSha(applyResult.installedSha)})
              </div>
              <p className="mt-1 text-emerald-800 dark:text-emerald-300">
                Reiniciados: {applyResult.restartedServices.join(' · ')}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {confirmInstall && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium">
                Confirmar instalação dos arquivos de {GITHUB_UPDATE_REPO} e reinício imediato dos
                serviços?
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  disabled={isApplying}
                  onClick={() => handleApplyOrRestart(false)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isApplying ? 'Instalando e reiniciando...' : 'Confirmar e Instalar'}
                </button>
                <button
                  type="button"
                  disabled={isApplying}
                  onClick={() => setConfirmInstall(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={checkUpdates}
            disabled={isChecking || isApplying}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Verificar novamente</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleApplyOrRestart(true)}
              disabled={isApplying || isChecking}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isApplying ? 'animate-spin' : ''}`} />
              <span>Reiniciar Serviços</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmInstall(true)}
              disabled={isApplying || isChecking || !status}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <DownloadCloud className="h-3.5 w-3.5" />
              <span>
                {status?.hasUpdate ? 'Instalar e Reiniciar' : 'Reinstalar e Reiniciar'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
