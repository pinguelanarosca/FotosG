import type {
  BackupRunLog,
  CloudTarget,
  FaceCluster,
  GoogleAccount,
  MediaItem,
  ShareRule,
} from '../types/vault';
import type { GoogleContactSuggestion } from '../services/googleAuth';

export const SEED_ACCOUNTS: GoogleAccount[] = [];

export const SEED_FACES: FaceCluster[] = [];

export const SEED_MEDIA: MediaItem[] = [];

export const SEED_CLOUD_TARGETS: CloudTarget[] = [
  {
    id: 'google_drive',
    provider: 'google_drive',
    name: 'Google Drive (Cofre E2EE)',
    accountHint: 'Não vinculado',
    connected: false,
    autoSync: false,
    encryptedAtRest: true,
    lastBackupAt: '',
    usedGb: 0,
    quotaGb: 100,
  },
  {
    id: 'backblaze_b2',
    provider: 'backblaze_b2',
    name: 'Backblaze B2 Imutável',
    accountHint: 'Não vinculado',
    connected: false,
    autoSync: false,
    encryptedAtRest: true,
    lastBackupAt: '',
    usedGb: 0,
    quotaGb: 250,
  },
  {
    id: 'dropbox_vault',
    provider: 'dropbox_vault',
    name: 'Dropbox Vault Espelho',
    accountHint: 'Não vinculado',
    connected: false,
    autoSync: false,
    encryptedAtRest: true,
    lastBackupAt: '',
    usedGb: 0,
    quotaGb: 50,
  },
  {
    id: 'onedrive',
    provider: 'onedrive',
    name: 'Microsoft OneDrive',
    accountHint: 'Não vinculado',
    connected: false,
    autoSync: false,
    encryptedAtRest: true,
    lastBackupAt: '',
    usedGb: 0,
    quotaGb: 100,
  },
];

export const SEED_SHARE_RULES: ShareRule[] = [];

export const SEED_BACKUP_LOGS: BackupRunLog[] = [];

export const SEED_CONTACTS: GoogleContactSuggestion[] = [];
