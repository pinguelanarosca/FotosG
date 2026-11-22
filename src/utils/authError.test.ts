import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGoogleAuthError } from './authError';

test('formatGoogleAuthError guides 0.0.0.0 and 127.0.0.1 users to localhost', () => {
  const msg = formatGoogleAuthError(
    { code: 'auth/unauthorized-domain', message: 'Firebase: Error (auth/unauthorized-domain).' },
    { hostname: '0.0.0.0', port: '3040', projectId: 'demo-proj' }
  );
  assert.match(msg, /http:\/\/localhost:3040/);
  assert.match(msg, /demo-proj/);
});

test('formatGoogleAuthError shows exact unauthorized hostname for remote domains', () => {
  const msg = formatGoogleAuthError(
    new Error('Firebase: Error (auth/unauthorized-domain).'),
    { hostname: 'ais-dev-example.run.app', projectId: 'demo-proj' }
  );
  assert.match(msg, /ais-dev-example\.run\.app/);
  assert.match(msg, /Authorized domains/);
});

test('formatGoogleAuthError translates popup errors cleanly', () => {
  assert.match(
    formatGoogleAuthError({ code: 'auth/popup-blocked' }),
    /pop-ups/i
  );
  assert.match(
    formatGoogleAuthError({ code: 'auth/popup-closed-by-user' }),
    /cancelado/i
  );
});
