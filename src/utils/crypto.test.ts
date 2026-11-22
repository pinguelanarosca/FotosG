import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptBytes,
  decryptJsonPayload,
  deriveVaultKey,
  encryptBytes,
  encryptJsonPayload,
  generateVaultKeySalt,
} from './crypto';

test('AES-256-GCM encrypts and decrypts binary media bytes roundtrip', async () => {
  const salt = generateVaultKeySalt();
  const key = await deriveVaultKey('cofre-secreto-2026', salt);
  const original = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 42, 99, 255]);

  const encrypted = await encryptBytes(original, key);
  assert.equal(encrypted.algorithm, 'AES-256-GCM');
  assert.equal(encrypted.ivHex.length, 24);
  assert.equal(encrypted.sha256Hex.length, 64);

  const decrypted = await decryptBytes(encrypted.ciphertextBase64, encrypted.ivHex, key);
  assert.deepEqual(decrypted, original);
});

test('AES-256-GCM rejects decryption with a wrong passphrase key', async () => {
  const salt = generateVaultKeySalt();
  const rightKey = await deriveVaultKey('chave-correta', salt);
  const wrongKey = await deriveVaultKey('chave-errada', salt);

  const encrypted = await encryptJsonPayload({ secret: 'album-privado' }, rightKey);
  await assert.rejects(() =>
    decryptJsonPayload(encrypted.ciphertextBase64, encrypted.ivHex, wrongKey)
  );
});

test('encryptJsonPayload preserves structured share metadata cleanly', async () => {
  const salt = generateVaultKeySalt();
  const key = await deriveVaultKey('familia-2026', salt);
  const payload = { mediaId: 'm1', canDownload: false, stripExif: true };

  const encrypted = await encryptJsonPayload(payload, key);
  const decoded = await decryptJsonPayload<typeof payload>(
    encrypted.ciphertextBase64,
    encrypted.ivHex,
    key
  );
  assert.deepEqual(decoded, payload);
});
