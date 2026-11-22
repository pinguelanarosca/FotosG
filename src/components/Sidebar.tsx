import {
  FolderHeart,
  HardDrive,
  Lock,
  PartyPopper,
  Plane,
  ShieldAlert,
  Sun,
  Unlock,
  X,
} from 'lucide-react';
import type { ContentCluster, GoogleAccount, SafetyShieldState } from '../types/vault';

interface SidebarProps {
  accounts: GoogleAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  selectedCluster: ContentCluster;
  onSelectCluster: (cluster: ContentCluster) => void;
  clusterCounts: Record<ContentCluster, number>;
  safety: SafetyShieldState;
  onRequestUnlockSafety: () => void;
  onLockSafety: () => void;
  onConnectGoogleAccount: () => void;
  isConnectingGoogle: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

const CLUSTER_ITEMS: Array<{
  id: ContentCluster;
  label: string;
  icon: typeof FolderHeart;
}> = [
  { id: 'all', label: 'Todas as Mídias', icon: HardDrive },
  { id: 'festas', label: 'Festas & Eventos', icon: PartyPopper },
  { id: 'ar_livre', label: 'Ar Livre & Trilhas', icon: Sun },
  { id: 'viagens', label: 'Viagens', icon: Plane },
  { id: 'familia', label: 'Família', icon: FolderHeart },
  { id: 'nsfw_18', label: 'Conteúdo 18+ NSFW', icon: ShieldAlert },
];

export function Sidebar({
  accounts,
  selectedAccountId,
  onSelectAccount,
  selectedCluster,
  onSelectCluster,
  clusterCounts,
  safety,
  onRequestUnlockSafety,
  onLockSafety,
  onConnectGoogleAccount,
  isConnectingGoogle,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const totalMediaCount = clusterCounts.all;

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto px-4 py-5">
      <div className="space-y-6">
        <div className="flex items-center justify-between lg:hidden">
          <span className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Contas e Categorias
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu lateral"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <section aria-labelledby="sidebar-accounts-heading" className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2
              id="sidebar-accounts-heading"
              className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400"
            >
              Contas Chrome conectadas
            </h2>
            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {accounts.length}
            </span>
          </div>

          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onSelectAccount('all');
                onCloseMobile();
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selectedAccountId === 'all'
                  ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
              }`}
            >
              <span className="truncate">Todas as contas</span>
              <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {totalMediaCount}
              </span>
            </button>

            {accounts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Nenhuma conta conectada ainda.
              </p>
            ) : (
              accounts.map((account) => {
                const active = selectedAccountId === account.id;
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      onSelectAccount(account.id);
                      onCloseMobile();
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{account.profileLabel}</div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {account.email}
                      </div>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                      {account.mediaCount}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={onConnectGoogleAccount}
            disabled={isConnectingGoogle}
            className="gsi-material-button w-full mt-2"
          >
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  style={{ display: 'block' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {isConnectingGoogle ? 'Conectando...' : 'Conectar conta Google'}
              </span>
            </div>
          </button>
        </section>

        <div className="border-t border-slate-200 dark:border-slate-800" />

        <section aria-labelledby="sidebar-clusters-heading" className="space-y-2">
          <h2
            id="sidebar-clusters-heading"
            className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400"
          >
            Agrupamento por conteúdo
          </h2>
          <div className="space-y-1">
            {CLUSTER_ITEMS.map((cluster) => {
              const Icon = cluster.icon;
              const active = selectedCluster === cluster.id;
              return (
                <button
                  key={cluster.id}
                  type="button"
                  onClick={() => {
                    onSelectCluster(cluster.id);
                    onCloseMobile();
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'bg-slate-900 font-medium text-white dark:bg-slate-100 dark:text-slate-950'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{cluster.label}</span>
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      active ? 'text-slate-200 dark:text-slate-700' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {clusterCounts[cluster.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Proteção 18+ e Facial
            </span>
            {safety.nsfwUnlocked || safety.facesUnlocked ? (
              <Unlock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {safety.nsfwUnlocked || safety.facesUnlocked
              ? 'Conteúdo sensível visível nesta sessão.'
              : 'Mídias 18+ NSFW e rostos protegidos estão ocultos.'}
          </p>
          <button
            type="button"
            onClick={safety.nsfwUnlocked || safety.facesUnlocked ? onLockSafety : onRequestUnlockSafety}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {safety.nsfwUnlocked || safety.facesUnlocked
              ? 'Bloquear cofre sensível'
              : 'Desbloquear filtro'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:block">
        {sidebarContent}
      </aside>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-white shadow-xl dark:bg-slate-950">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
