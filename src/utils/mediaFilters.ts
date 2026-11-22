import type {
  ContentCluster,
  FaceCluster,
  GoogleAccount,
  MediaFilterState,
  MediaItem,
  SafetyShieldState,
  SharePermissions,
} from '../types/vault';

export interface MaskEvaluation {
  masked: boolean;
  reason: 'nsfw_locked' | 'face_locked' | null;
  lockedFaceNames: string[];
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function evaluateMediaMask(
  item: MediaItem,
  safety: SafetyShieldState,
  faces: FaceCluster[]
): MaskEvaluation {
  if (item.isNsfw18Plus && !safety.nsfwUnlocked) {
    return {
      masked: true,
      reason: 'nsfw_locked',
      lockedFaceNames: [],
    };
  }

  const lockedFaces = faces.filter(
    (face) => face.safetyLock && item.faceIds.includes(face.id)
  );

  if (lockedFaces.length > 0 && !safety.facesUnlocked) {
    return {
      masked: true,
      reason: 'face_locked',
      lockedFaceNames: lockedFaces.map((f) => f.name),
    };
  }

  return {
    masked: false,
    reason: null,
    lockedFaceNames: [],
  };
}

export function filterMediaItems(
  items: MediaItem[],
  filters: MediaFilterState,
  accounts: GoogleAccount[],
  faces: FaceCluster[],
  smartMatchedIds?: string[] | null
): MediaItem[] {
  const queryNorm = normalizeText(filters.searchQuery);
  const tokens = queryNorm ? queryNorm.split(/\s+/).filter(Boolean) : [];
  const locationNorm = normalizeText(filters.location);

  const accountById = new Map(accounts.map((acc) => [acc.id, acc]));
  const faceById = new Map(faces.map((face) => [face.id, face]));
  const smartIdSet = smartMatchedIds && smartMatchedIds.length > 0 ? new Set(smartMatchedIds) : null;

  return items.filter((item) => {
    if (filters.accountId !== 'all' && item.accountId !== filters.accountId) {
      return false;
    }

    if (filters.cluster !== 'all' && item.cluster !== filters.cluster) {
      return false;
    }

    if (filters.mediaType !== 'all' && item.mediaType !== filters.mediaType) {
      return false;
    }

    if (filters.faceId !== 'all' && !item.faceIds.includes(filters.faceId)) {
      return false;
    }

    if (locationNorm) {
      const itemLocation = normalizeText(`${item.location} ${item.country}`);
      if (!itemLocation.includes(locationNorm)) {
        return false;
      }
    }

    const itemDate = item.capturedAt.slice(0, 10);
    if (filters.dateFrom && itemDate < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && itemDate > filters.dateTo) {
      return false;
    }

    if (smartIdSet && smartIdSet.has(item.id)) {
      return true;
    }

    if (tokens.length > 0) {
      const account = accountById.get(item.accountId);
      const faceNames = item.faceIds
        .map((id) => faceById.get(id)?.name ?? '')
        .join(' ');
      const clusterKeywords: Record<Exclude<ContentCluster, 'all'>, string> = {
        festas: 'festa festas celebracao noite brindes evento',
        ar_livre: 'ar livre trilha natureza praia montanha sol',
        viagens: 'viagem viagens turismo cidade paisagem',
        familia: 'familia criancas reuniao casa picnic',
        nsfw_18: '18+ nsfw adulto sensivel privado restrito',
      };

      const haystack = normalizeText(
        [
          item.title,
          item.location,
          item.country,
          item.capturedAt,
          item.mediaType === 'video' ? 'video filme' : 'foto imagem',
          item.tags.join(' '),
          clusterKeywords[item.cluster],
          account?.email ?? '',
          account?.profileLabel ?? '',
          faceNames,
        ].join(' ')
      );

      const allMatch = tokens.every((token) => haystack.includes(token));
      if (!allMatch) {
        return false;
      }
    }

    return true;
  });
}

export function computeClusterCounts(items: MediaItem[]): Record<ContentCluster, number> {
  const counts: Record<ContentCluster, number> = {
    all: items.length,
    festas: 0,
    ar_livre: 0,
    viagens: 0,
    familia: 0,
    nsfw_18: 0,
  };

  for (const item of items) {
    counts[item.cluster] += 1;
  }

  return counts;
}

export function validateShareRuleInput(input: {
  recipientName: string;
  recipientEmail: string;
  permissions: SharePermissions;
}): { valid: boolean; error?: string } {
  const name = input.recipientName.trim();
  const email = input.recipientEmail.trim();

  if (name.length < 2) {
    return { valid: false, error: 'Informe o nome do destinatário (mínimo 2 caracteres).' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Informe um endereço de e-mail válido.' };
  }
  if (!input.permissions.canView && !input.permissions.canDownload) {
    return { valid: false, error: 'Selecione ao menos uma permissão (visualizar ou baixar).' };
  }
  if (input.permissions.expiresInDays < 1 || input.permissions.expiresInDays > 365) {
    return { valid: false, error: 'A validade do link deve ficar entre 1 e 365 dias.' };
  }

  return { valid: true };
}

export function formatBytesCompact(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
