import { useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { BackupRunLog, CloudTarget, GoogleAccount } from '../types/vault';
import { formatBytesCompact } from '../utils/mediaFilters';

interface BackupCloudViewProps {
  accounts: GoogleAccount[];
  cloudTargets: CloudTarget[];
  backupLogs: BackupRunLog[];
  vaultPassphraseSet: boolean;
  onToggleAccountBackup: (accountId: string) => void;
  onToggleCloudTarget: (targetId: string) => void;
  onToggleCloudAutoSync: (targetId: string) => void;
  onRunEncryptedBackupNow: () => Promise<void>;
  isBackingUp: boolean;
  onUpdatePassphrase: (passphrase: string) => Promise<void>;
  onConnectGoogleAccount: () => void;
  isConnectingGoogle: boolean;
  onSyncLiveGoogleAccount: (account: GoogleAccount) => Promise<void>;
  onOpenSystemUpdate: () => void;
}

export function BackupCloudView({
  accounts,
  cloudTargets,
  backupLogs,
  vaultPassphraseSet,
  onToggleAccountBackup,
  onToggleCloudTarget,
  onToggleCloudAutoSync,
  onRunEncryptedBackupNow,
  isBackingUp,
  onUpdatePassphrase,
  onConnectGoogleAccount,
  isConnectingGoogle,
  onSyncLiveGoogleAccount,
  onOpenSystemUpdate,
}: BackupCloudViewProps) {
  const [newPassphrase, setNewPassphrase] = useState('');
  const [passphraseStatus, setPassphraseStatus] = useState<string | null>(null);

  const handleSavePassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassphrase.trim().length < 4) {
      setPassphraseStatus('A chave mestra precisa ter no mínimo 4 caracteres.');
      return;
    }
    await onUpdatePassphrase(newPassphrase.trim());
    setNewPassphrase('');
    setPassphraseStatus('Chave AES-256-GCM derivada localmente via PBKDF2-SHA256.');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950 text-balance dark:text-slate-50">
            Backup Automático, Nuvem e Criptografia E2EE
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Todos os arquivos são criptografados no navegador com AES-256-GCM antes do envio aos
            destinos na nuvem.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenSystemUpdate}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={onRunEncryptedBackupNow}
            disabled={isBackingUp}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isBackingUp ? 'animate-spin' : ''}`} />
            <span>{isBackingUp ? 'Criptografando...' : 'Executar Backup Agora'}</span>
          </button>
        </div>
      </div>

      <section aria-labelledby="e2ee-key-heading" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 id="e2ee-key-heading" className="font-display text-base font-semibold text-slate-950 dark:text-slate-100">
                Chave Mestra de Criptografia Ponta a Ponta (AES-256-GCM)
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {vaultPassphraseSet
                ? 'Chave ativa em memória (PBKDF2 · 100.000 iterações · SHA-256). Nunca enviada ao servidor.'
                : 'Defina uma frase-senha personalizada para criptografar novos uploads e manifestos.'}
            </p>
          </div>

          <form onSubmit={handleSavePassphrase} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="vault-passphrase-input" className="sr-only">
              Nova frase-senha do cofre E2EE
            </label>
            <input
              id="vault-passphrase-input"
              type="password"
              value={newPassphrase}
              onChange={(e) => setNewPassphrase(e.target.value)}
              placeholder="Nova frase-senha E2EE..."
              className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-3.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white whitespace-nowrap shrink-0"
            >
              Atualizar Chave
            </button>
          </form>
        </div>
        {passphraseStatus && (
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{passphraseStatus}</p>
        )}
      </section>

      <section aria-labelledby="chrome-accounts-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="chrome-accounts-heading" className="font-display text-base font-semibold text-slate-950 dark:text-slate-100">
            Contas Google do Chrome sincronizadas
          </h2>
          <button
            type="button"
            onClick={onConnectGoogleAccount}
            disabled={isConnectingGoogle}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap shrink-0"
          >
            {isConnectingGoogle ? 'Conectando...' : '+ Adicionar conta'}
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Nenhuma conta Google conectada
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-600 dark:text-slate-400">
              Conecte uma ou mais contas Google do Chrome para sincronizar mídias e habilitar o
              backup automático criptografado.
            </p>
            <button
              type="button"
              onClick={onConnectGoogleAccount}
              disabled={isConnectingGoogle}
              className="mt-4 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isConnectingGoogle ? 'Conectando...' : 'Conectar conta Google'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-display text-sm font-semibold text-slate-950 dark:text-slate-100">
                      {acc.displayName}
                    </div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {acc.email}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                    {acc.isLiveOAuth ? 'OAuth Ativo' : 'Sincronizada'}
                  </span>
                </div>

                <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                  {acc.chromeProfile} ·{' '}
                  <span className="font-mono tabular-nums">{acc.mediaCount}</span> mídias ·{' '}
                  <span className="font-mono tabular-nums">{acc.storageUsedGb.toFixed(1)} GB</span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={acc.autoBackup}
                      onChange={() => onToggleAccountBackup(acc.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span>Backup automático</span>
                  </label>

                  {acc.isLiveOAuth && (
                    <button
                      type="button"
                      onClick={() => onSyncLiveGoogleAccount(acc)}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Re-sincronizar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="cloud-targets-heading" className="space-y-3">
        <h2 id="cloud-targets-heading" className="font-display text-base font-semibold text-slate-950 dark:text-slate-100">
          Serviços de armazenamento na nuvem
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cloudTargets.map((target) => {
            const pct = Math.min(100, Math.round((target.usedGb / target.quotaGb) * 100));
            return (
              <div
                key={target.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Cloud className="h-5 w-5 shrink-0 text-slate-600 dark:text-slate-300" />
                    <div className="min-w-0">
                      <div className="truncate font-display text-sm font-semibold text-slate-950 dark:text-slate-100">
                        {target.name}
                      </div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {target.accountHint}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleCloudTarget(target.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      target.connected
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {target.connected ? 'Conectado' : 'Conectar'}
                  </button>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                    <span>
                      {target.usedGb.toFixed(1)} GB / {target.quotaGb} GB
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full bg-blue-600 dark:bg-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                  <label className="flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={target.autoSync}
                      disabled={!target.connected}
                      onChange={() => onToggleCloudAutoSync(target.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span>Sincronização automática</span>
                  </label>
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>E2EE ativo</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="backup-logs-heading" className="space-y-3">
        <h2 id="backup-logs-heading" className="font-display text-base font-semibold text-slate-950 dark:text-slate-100">
          Histórico de backups criptografados
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <th className="px-4 py-2.5">Data / Hora</th>
                  <th className="px-4 py-2.5">Destino na Nuvem</th>
                  <th className="px-4 py-2.5">Arquivos</th>
                  <th className="px-4 py-2.5">Volume</th>
                  <th className="px-4 py-2.5">Hash SHA-256 do Manifesto</th>
                  <th className="px-4 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {backupLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                    >
                      Nenhum backup executado ainda. Conecte um serviço de nuvem e clique em
                      &quot;Executar Backup Agora&quot;.
                    </td>
                  </tr>
                ) : (
                  backupLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-200">
                        {log.targetName}
                      </td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {log.itemsEncrypted}
                      </td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatBytesCompact(log.bytesProcessed)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">
                        {log.manifestHash}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Concluído</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
