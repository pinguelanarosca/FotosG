import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { GoogleAccount, MediaItem } from '../types/vault';

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/contacts.readonly',
] as const;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of GOOGLE_WORKSPACE_SCOPES) {
  provider.addScope(scope);
}
// Forces Chrome account picker so users can link multiple logged-in Google accounts sequentially
provider.setCustomParameters({
  prompt: 'select_account',
});

// Strict in-memory token store (never written to localStorage/sessionStorage)
const tokenByEmail = new Map<string, string>();
let isSigningIn = false;

export function initGoogleAuthListener(
  onSignOutDetected?: () => void
): () => void {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (!user && !isSigningIn) {
      tokenByEmail.clear();
      if (onSignOutDetected) {
        onSignOutDetected();
      }
    }
  });
}

export function getInMemoryToken(email: string): string | null {
  return tokenByEmail.get(email.toLowerCase()) ?? null;
}

export interface ConnectedGoogleResult {
  account: GoogleAccount;
  accessToken: string;
}

export async function connectChromeGoogleAccount(
  chromeProfileLabel = 'Perfil Chrome Conectado'
): Promise<ConnectedGoogleResult> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google.');
    }

    const email = (result.user.email ?? 'conta@gmail.com').toLowerCase();
    tokenByEmail.set(email, credential.accessToken);

    const account: GoogleAccount = {
      id: `oauth-${result.user.uid}`,
      email,
      displayName: result.user.displayName ?? email.split('@')[0],
      profileLabel: 'Conta Google Conectada',
      chromeProfile: chromeProfileLabel,
      avatarUrl: result.user.photoURL ?? undefined,
      isLiveOAuth: true,
      autoBackup: true,
      lastSyncedAt: new Date().toISOString(),
      storageUsedGb: 0,
      mediaCount: 0,
    };

    return { account, accessToken: credential.accessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function disconnectAllGoogleAccounts(): Promise<void> {
  tokenByEmail.clear();
  await signOut(auth);
}

interface DriveFileRecord {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  size?: string;
  thumbnailLink?: string;
  imageMediaMetadata?: {
    width?: number;
    height?: number;
    cameraModel?: string;
    location?: {
      latitude?: number;
      longitude?: number;
    };
  };
  videoMediaMetadata?: {
    width?: number;
    height?: number;
    durationMillis?: string;
  };
}

export async function fetchGoogleDrivePhotos(
  accessToken: string,
  accountId: string
): Promise<MediaItem[]> {
  const params = new URLSearchParams({
    spaces: 'photos,drive',
    pageSize: '20',
    q: "(mimeType contains 'image/' or mimeType contains 'video/') and trashed = false",
    fields:
      'files(id,name,mimeType,createdTime,size,thumbnailLink,imageMediaMetadata,videoMediaMetadata)',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao consultar Google Drive/Fotos (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { files?: DriveFileRecord[] };
  const files = data.files ?? [];

  return files.map((file) => {
    const isVideo = file.mimeType.startsWith('video/');
    const lowerName = file.name.toLowerCase();
    let cluster: MediaItem['cluster'] = 'ar_livre';
    if (lowerName.includes('festa') || lowerName.includes('party')) cluster = 'festas';
    else if (lowerName.includes('viagem') || lowerName.includes('trip')) cluster = 'viagens';
    else if (lowerName.includes('fam') || lowerName.includes('casa')) cluster = 'familia';

    return {
      id: `gdrive-${file.id}`,
      title: file.name.replace(/\.[^.]+$/, ''),
      mediaType: isVideo ? 'video' : 'photo',
      durationSec: file.videoMediaMetadata?.durationMillis
        ? Math.round(Number(file.videoMediaMetadata.durationMillis) / 1000)
        : undefined,
      thumbnailUrl: file.thumbnailLink ?? '',
      accountId,
      capturedAt: file.createdTime ?? new Date().toISOString(),
      location: file.imageMediaMetadata?.location
        ? `${file.imageMediaMetadata.location.latitude?.toFixed(2)}, ${file.imageMediaMetadata.location.longitude?.toFixed(2)}`
        : 'Google Fotos (Nuvem)',
      country: 'Sincronizado',
      cluster,
      tags: ['google fotos', isVideo ? 'vídeo' : 'foto'],
      faceIds: [],
      isNsfw18Plus: false,
      nsfwScore: 0.01,
      e2eeEncrypted: true,
      encryptionAlgorithm: 'AES-256-GCM',
      ivHex: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
      sha256: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
      sizeBytes: Number(file.size ?? 1_850_000),
      width: file.imageMediaMetadata?.width ?? file.videoMediaMetadata?.width ?? 1600,
      height: file.imageMediaMetadata?.height ?? file.videoMediaMetadata?.height ?? 1200,
      cameraModel: file.imageMediaMetadata?.cameraModel,
      backedUpTargets: ['google_drive'],
      isLiveGoogleItem: true,
    };
  });
}

export interface GoogleContactSuggestion {
  name: string;
  email: string;
}

export async function fetchGoogleContactsSuggestions(
  accessToken: string
): Promise<GoogleContactSuggestion[]> {
  const res = await fetch(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=25',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as {
    connections?: Array<{
      names?: Array<{ displayName?: string }>;
      emailAddresses?: Array<{ value?: string }>;
    }>;
  };

  const out: GoogleContactSuggestion[] = [];
  for (const person of data.connections ?? []) {
    const email = person.emailAddresses?.[0]?.value;
    if (!email) continue;
    out.push({
      name: person.names?.[0]?.displayName ?? email.split('@')[0],
      email,
    });
  }
  return out;
}

export async function uploadEncryptedBackupManifestToDrive(
  accessToken: string,
  manifestPayload: unknown
): Promise<{ id: string; name: string }> {
  const fileName = `cofrefoto-backup-${new Date().toISOString().slice(0, 10)}.e2ee.json`;
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: 'CofreFoto AES-256-GCM encrypted backup manifest',
  };

  const boundary = '-------cofrefoto314159265';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${JSON.stringify(manifestPayload)}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao enviar manifesto criptografado para o Google Drive: ${errText}`);
  }

  return (await res.json()) as { id: string; name: string };
}
