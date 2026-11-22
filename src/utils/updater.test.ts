import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareCommitStatus,
  formatShortSha,
  GITHUB_UPDATE_REPO,
  isValidGitSha,
} from './updater';

const SHA_A = 'dd533f7a1b2c3d4e5f60718293a4b5c6d7e8f901';
const SHA_B = '9e20295a1b2c3d4e5f60718293a4b5c6d7e8f902';

test('isValidGitSha accepts only 40-character hexadecimal SHAs', () => {
  assert.equal(isValidGitSha(SHA_A), true);
  assert.equal(isValidGitSha('dd533f7'), false);
  assert.equal(isValidGitSha('rm -rf /; ' + SHA_A), false);
});

test('compareCommitStatus detects when remote commit differs from installed SHA', () => {
  const same = compareCommitStatus({
    installedSha: SHA_A,
    latestSha: SHA_A,
    latestMessage: 'feat: sync',
    latestAuthorDate: '2026-11-22T09:00:00Z',
  });
  assert.equal(same.repo, GITHUB_UPDATE_REPO);
  assert.equal(same.hasUpdate, false);
  assert.equal(formatShortSha(same.latestSha), 'dd533f7');

  const changed = compareCommitStatus({
    installedSha: SHA_A,
    latestSha: SHA_B,
    latestMessage: 'fix: backup pipeline',
    latestAuthorDate: '2026-11-22T10:00:00Z',
  });
  assert.equal(changed.hasUpdate, true);
  assert.equal(changed.installedSha, SHA_A);
  assert.equal(changed.latestSha, SHA_B);
});
