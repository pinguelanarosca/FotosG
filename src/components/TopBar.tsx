import { Menu, Upload } from 'lucide-react';
import type { AppSection } from '../types/vault';

interface TopBarProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  onOpenUploadModal: () => void;
  onToggleMobileMenu: () => void;
}

const NAV_ITEMS: Array<{ id: AppSection; label: string }> = [
  { id: 'gallery', label: 'Galeria' },
  { id: 'faces', label: 'Rostos' },
  { id: 'sharing', label: 'Compartilhamento' },
  { id: 'backup', label: 'Backup' },
];

export function TopBar({
  activeSection,
  onSelectSection,
  onOpenUploadModal,
  onToggleMobileMenu,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-8 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95 lg:px-6">
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Abrir menu lateral"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectSection('gallery');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0 dark:text-slate-50"
        >
          CofreFoto
        </a>
      </div>

      <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-6">
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-blue-600 dark:bg-blue-400"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenUploadModal}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 whitespace-nowrap shrink-0"
        >
          <Upload className="h-4 w-4" />
          <span>Enviar Mídia</span>
        </button>
      </div>
    </header>
  );
}
