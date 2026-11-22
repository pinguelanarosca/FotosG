export type MediaType = 'photo' | 'video';

export type ContentCluster =
  | 'all'
  | 'festas'
  | 'ar_livre'
  | 'viagens'
  | 'familia'
  | 'nsfw_18';

export type AppSection = 'gallery' | 'faces' | 'sharing' | 'backup';

export interface GoogleAccount {
  id: string;
  email: string;
  displayName: string;
  profileLabel: string;
  chromeProfile: string;
  avatarUrl?: string;
  isLiveOAuth: boolean;
  autoBackup: boolean;
  lastSyncedAt: string;
  storageUsedGb: number;
  mediaCount: number;
}

export interface FaceCluster {
  id: string;
  name: string;
  relation: string;
  avatarUrl: string;
  photoCount: number;
  safetyLock: boolean;
  hideInShared: boolean;
  confidenceAvg: number;
}

export interface CloudTarget {
  id: string;
  provider: 'google_drive' | 'backblaze_b2' | 'dropbox_vault' | 'onedrive';
  name: string;
  accountHint: string;
  connected: boolean;
  autoSync: boolean;
  encryptedAtRest: boolean;
  lastBackupAt: string;
  usedGb: number;
  quotaGb: number;
}

export interface SharePermissions {
  canView: boolean;
  canDownload: boolean;
  stripExifLocation: boolean;
  requireE2eePasscode: boolean;
  expiresInDays: number;
}

export interface ShareRule {
  id: string;
  mediaId: string;
  mediaTitle: string;
  recipientName: string;
  recipientEmail: string;
  relationship: 'Amigo' | 'Família' | 'Convidado';
  permissions: SharePermissions;
  createdAt: string;
  expiresAt: string;
  shareToken: string;
  encryptedKeyFragment: string;
  revoked: boolean;
}

export interface BackupRunLog {
  id: string;
  timestamp: string;
  targetName: string;
  itemsEncrypted: number;
  bytesProcessed: number;
  status: 'completed' | 'partial' | 'error';
  manifestHash: string;
}

export interface MediaItem {
  id: string;
  title: string;
  mediaType: MediaType;
  durationSec?: number;
  thumbnailUrl: string;
  accountId: string;
  capturedAt: string;
  location: string;
  country: string;
  cluster: Exclude<ContentCluster, 'all'>;
  tags: string[];
  faceIds: string[];
  isNsfw18Plus: boolean;
  nsfwScore: number;
  e2eeEncrypted: boolean;
  encryptionAlgorithm: 'AES-256-GCM';
  ivHex: string;
  sha256: string;
  sizeBytes: number;
  width: number;
  height: number;
  cameraModel?: string;
  backedUpTargets: string[];
  isLiveGoogleItem?: boolean;
  encryptedBlobBase64?: string;
}

export interface MediaFilterState {
  searchQuery: string;
  accountId: string;
  cluster: ContentCluster;
  mediaType: 'all' | MediaType;
  location: string;
  faceId: string;
  dateFrom: string;
  dateTo: string;
}

export interface SafetyShieldState {
  nsfwUnlocked: boolean;
  facesUnlocked: boolean;
  blurStrength: 'strict' | 'subtle';
}
