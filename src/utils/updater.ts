export const GITHUB_UPDATE_REPO = 'pinguelanarosca/FotosG' as const;
export const GITHUB_UPDATE_BRANCH = 'main' as const;

export interface UpdateStatusResponse {
  repo: string;
  branch: string;
  installedSha: string;
  latestSha: string;
  latestMessage: string;
  latestAuthorDate: string;
  hasUpdate: boolean;
  checkedAt: string;
}

export interface ApplyUpdateResponse {
  ok: boolean;
  installedSha: string;
  dependenciesInstalled: boolean;
  rebuilt: boolean;
  restartedServices: string[];
  completedAt: string;
}

export function isValidGitSha(sha: string): boolean {
  return /^[0-9a-f]{40}$/i.test(sha.trim());
}

export function compareCommitStatus(input: {
  installedSha: string | null;
  latestSha: string;
  latestMessage: string;
  latestAuthorDate: string;
  checkedAt?: string;
}): UpdateStatusResponse {
  const normalizedLatest = input.latestSha.trim().toLowerCase();
  if (!isValidGitSha(normalizedLatest)) {
    throw new Error('SHA de commit remoto inválido.');
  }

  const normalizedInstalled = input.installedSha?.trim().toLowerCase() ?? '';
  const hasUpdate =
    normalizedInstalled === '' || normalizedInstalled !== normalizedLatest;

  return {
    repo: GITHUB_UPDATE_REPO,
    branch: GITHUB_UPDATE_BRANCH,
    installedSha: normalizedInstalled || normalizedLatest,
    latestSha: normalizedLatest,
    latestMessage: input.latestMessage.trim() || 'Sem descrição de commit',
    latestAuthorDate: input.latestAuthorDate,
    hasUpdate,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
  };
}

export function formatShortSha(sha: string): string {
  return sha.trim().slice(0, 7);
}
