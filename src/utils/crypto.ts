const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export interface EncryptedPayload {
  ivHex: string;
  ciphertextBase64: string;
  sha256Hex: string;
  algorithm: 'AES-256-GCM';
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hexadecimal inválido.');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function getSubtle(): SubtleCrypto {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('Web Crypto API indisponível neste ambiente.');
  }
  return globalThis.crypto.subtle;
}

export function generateVaultKeySalt(): string {
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  return bytesToHex(salt);
}

export async function computeSha256Hex(data: Uint8Array): Promise<string> {
  const subtle = getSubtle();
  const copy = new Uint8Array(data);
  const digest = await subtle.digest('SHA-256', copy.buffer);
  return bytesToHex(new Uint8Array(digest));
}

export async function deriveVaultKey(passphrase: string, saltHex: string): Promise<CryptoKey> {
  if (!passphrase || passphrase.trim().length < 4) {
    throw new Error('A frase-senha do cofre precisa ter pelo menos 4 caracteres.');
  }
  const subtle = getSubtle();
  const saltBytes = new Uint8Array(hexToBytes(saltHex));
  const keyMaterial = await subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBytes(data: Uint8Array, key: CryptoKey): Promise<EncryptedPayload> {
  const subtle = getSubtle();
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const inputCopy = new Uint8Array(data);

  const encryptedBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer },
    key,
    inputCopy.buffer
  );

  const cipherBytes = new Uint8Array(encryptedBuffer);
  const sha256Hex = await computeSha256Hex(cipherBytes);

  return {
    ivHex: bytesToHex(iv),
    ciphertextBase64: bytesToBase64(cipherBytes),
    sha256Hex,
    algorithm: 'AES-256-GCM',
  };
}

export async function decryptBytes(
  ciphertextBase64: string,
  ivHex: string,
  key: CryptoKey
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const iv = new Uint8Array(hexToBytes(ivHex));
  const cipherBytes = new Uint8Array(base64ToBytes(ciphertextBase64));

  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer },
    key,
    cipherBytes.buffer
  );

  return new Uint8Array(decryptedBuffer);
}

export async function encryptJsonPayload(payload: unknown, key: CryptoKey): Promise<EncryptedPayload> {
  const encoded = TEXT_ENCODER.encode(JSON.stringify(payload));
  return encryptBytes(encoded, key);
}

export async function decryptJsonPayload<T>(
  ciphertextBase64: string,
  ivHex: string,
  key: CryptoKey
): Promise<T> {
  const decrypted = await decryptBytes(ciphertextBase64, ivHex, key);
  return JSON.parse(TEXT_DECODER.decode(decrypted)) as T;
}
