import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeClusterCounts,
  evaluateMediaMask,
  filterMediaItems,
  validateShareRuleInput,
} from './mediaFilters';
import type {
  FaceCluster,
  GoogleAccount,
  MediaFilterState,
  MediaItem,
  SafetyShieldState,
} from '../types/vault';

const accounts: GoogleAccount[] = [
  {
    id: 'acc-1',
    email: 'pessoal@gmail.com',
    displayName: 'Alexandre',
    profileLabel: 'Pessoal',
    chromeProfile: 'Perfil 1',
    isLiveOAuth: false,
    autoBackup: true,
    lastSyncedAt: '2026-11-22T00:00:00Z',
    storageUsedGb: 12.4,
    mediaCount: 3,
  },
  {
    id: 'acc-2',
    email: 'trabalho@empresa.com',
    displayName: 'Studio',
    profileLabel: 'Trabalho',
    chromeProfile: 'Perfil 2',
    isLiveOAuth: false,
    autoBackup: true,
    lastSyncedAt: '2026-11-22T00:00:00Z',
    storageUsedGb: 4.2,
    mediaCount: 1,
  },
];

const faces: FaceCluster[] = [
  {
    id: 'face-ana',
    name: 'Ana Clara',
    relation: 'Família',
    avatarUrl: '',
    photoCount: 2,
    safetyLock: false,
    hideInShared: false,
    confidenceAvg: 0.98,
  },
  {
    id: 'face-mariana',
    name: 'Mariana',
    relation: 'Privado',
    avatarUrl: '',
    photoCount: 1,
    safetyLock: true,
    hideInShared: true,
    confidenceAvg: 0.96,
  },
];

const items: MediaItem[] = [
  {
    id: 'm1',
    title: 'Trilha Costa da Lagoa',
    mediaType: 'photo',
    thumbnailUrl: '/a.jpg',
    accountId: 'acc-1',
    capturedAt: '2026-10-14T17:20:00Z',
    location: 'Florianópolis, SC',
    country: 'Brasil',
    cluster: 'ar_livre',
    tags: ['montanha', 'mar', 'pôr do sol'],
    faceIds: ['face-ana'],
    isNsfw18Plus: false,
    nsfwScore: 0.01,
    e2eeEncrypted: true,
    encryptionAlgorithm: 'AES-256-GCM',
    ivHex: '00',
    sha256: 'aa',
    sizeBytes: 3_200_000,
    width: 1600,
    height: 1200,
    backedUpTargets: ['google_drive'],
  },
  {
    id: 'm2',
    title: 'Festa no Terraço',
    mediaType: 'video',
    durationSec: 42,
    thumbnailUrl: '/b.jpg',
    accountId: 'acc-2',
    capturedAt: '2026-11-02T22:10:00Z',
    location: 'São Paulo, SP',
    country: 'Brasil',
    cluster: 'festas',
    tags: ['brinde', 'luzes', 'amigos'],
    faceIds: ['face-ana', 'face-mariana'],
    isNsfw18Plus: false,
    nsfwScore: 0.04,
    e2eeEncrypted: true,
    encryptionAlgorithm: 'AES-256-GCM',
    ivHex: '11',
    sha256: 'bb',
    sizeBytes: 18_400_000,
    width: 1920,
    height: 1080,
    backedUpTargets: ['google_drive'],
  },
  {
    id: 'm3',
    title: 'Ensaio Íntimo Hotel',
    mediaType: 'photo',
    thumbnailUrl: '/c.jpg',
    accountId: 'acc-1',
    capturedAt: '2026-11-10T23:45:00Z',
    location: 'Rio de Janeiro, RJ',
    country: 'Brasil',
    cluster: 'nsfw_18',
    tags: ['privado', 'monocromático'],
    faceIds: [],
    isNsfw18Plus: true,
    nsfwScore: 0.94,
    e2eeEncrypted: true,
    encryptionAlgorithm: 'AES-256-GCM',
    ivHex: '22',
    sha256: 'cc',
    sizeBytes: 4_100_000,
    width: 1600,
    height: 1200,
    backedUpTargets: ['backblaze_b2'],
  },
];

const defaultFilters: MediaFilterState = {
  searchQuery: '',
  accountId: 'all',
  cluster: 'all',
  mediaType: 'all',
  location: '',
  faceId: 'all',
  dateFrom: '',
  dateTo: '',
};

test('filterMediaItems filters accurately by account, cluster, date range, location and face', () => {
  const byAccount = filterMediaItems(items, { ...defaultFilters, accountId: 'acc-2' }, accounts, faces);
  assert.deepEqual(byAccount.map((i) => i.id), ['m2']);

  const byCluster = filterMediaItems(items, { ...defaultFilters, cluster: 'ar_livre' }, accounts, faces);
  assert.deepEqual(byCluster.map((i) => i.id), ['m1']);

  const byLocation = filterMediaItems(items, { ...defaultFilters, location: 'florianopolis' }, accounts, faces);
  assert.deepEqual(byLocation.map((i) => i.id), ['m1']);

  const byDate = filterMediaItems(
    items,
    { ...defaultFilters, dateFrom: '2026-11-01', dateTo: '2026-11-05' },
    accounts,
    faces
  );
  assert.deepEqual(byDate.map((i) => i.id), ['m2']);

  const byFace = filterMediaItems(items, { ...defaultFilters, faceId: 'face-mariana' }, accounts, faces);
  assert.deepEqual(byFace.map((i) => i.id), ['m2']);

  const byQuery = filterMediaItems(items, { ...defaultFilters, searchQuery: 'brinde Ana' }, accounts, faces);
  assert.deepEqual(byQuery.map((i) => i.id), ['m2']);
});

test('evaluateMediaMask protects 18+ NSFW and safety-locked faces until unlocked', () => {
  const lockedState: SafetyShieldState = {
    nsfwUnlocked: false,
    facesUnlocked: false,
    blurStrength: 'strict',
  };

  assert.equal(evaluateMediaMask(items[0], lockedState, faces).masked, false);
  assert.equal(evaluateMediaMask(items[1], lockedState, faces).reason, 'face_locked');
  assert.equal(evaluateMediaMask(items[2], lockedState, faces).reason, 'nsfw_locked');

  const unlockedState: SafetyShieldState = {
    nsfwUnlocked: true,
    facesUnlocked: true,
    blurStrength: 'strict',
  };
  assert.equal(evaluateMediaMask(items[1], unlockedState, faces).masked, false);
  assert.equal(evaluateMediaMask(items[2], unlockedState, faces).masked, false);
});

test('computeClusterCounts returns accurate totals per category', () => {
  const counts = computeClusterCounts(items);
  assert.equal(counts.all, 3);
  assert.equal(counts.ar_livre, 1);
  assert.equal(counts.festas, 1);
  assert.equal(counts.nsfw_18, 1);
  assert.equal(counts.viagens, 0);
});

test('validateShareRuleInput enforces recipient email, name and at least one permission', () => {
  const invalidEmail = validateShareRuleInput({
    recipientName: 'Carlos',
    recipientEmail: 'invalido',
    permissions: {
      canView: true,
      canDownload: false,
      stripExifLocation: true,
      requireE2eePasscode: true,
      expiresInDays: 7,
    },
  });
  assert.equal(invalidEmail.valid, false);

  const noPerms = validateShareRuleInput({
    recipientName: 'Carlos',
    recipientEmail: 'carlos@exemplo.com',
    permissions: {
      canView: false,
      canDownload: false,
      stripExifLocation: true,
      requireE2eePasscode: true,
      expiresInDays: 7,
    },
  });
  assert.equal(noPerms.valid, false);

  const valid = validateShareRuleInput({
    recipientName: 'Carlos Silva',
    recipientEmail: 'carlos@exemplo.com',
    permissions: {
      canView: true,
      canDownload: true,
      stripExifLocation: true,
      requireE2eePasscode: false,
      expiresInDays: 14,
    },
  });
  assert.equal(valid.valid, true);
});
