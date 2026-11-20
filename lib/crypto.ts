export type EncryptedPayload = {
  ciphertext: `0x${string}`;
  iv: `0x${string}`;
};

export type EncryptedResult = {
  /** 32-byte AES key. It becomes the Fiber invoice payment preimage. */
  key: `0x${string}`;
  payload: EncryptedPayload;
};

export const toHex = (bytes: Uint8Array) =>
  `0x${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

export const fromHex = (value: string) =>
  Uint8Array.from(value.replace(/^0x/, '').match(/.{2}/g) ?? [], (part) =>
    Number.parseInt(part, 16),
  );

export async function encryptJson<T>(value: T): Promise<EncryptedResult & { plaintext: string }> {
  const plaintext = JSON.stringify(value);
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(keyBytes),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    key: toHex(keyBytes),
    plaintext,
    payload: {
      ciphertext: toHex(new Uint8Array(ciphertext)),
      iv: toHex(iv),
    },
  };
}

export async function decryptJson<T>(payload: EncryptedPayload, keyHex: string): Promise<{ value: T; plaintext: string }> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error('The pickup key must be 32 bytes of hexadecimal data.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(fromHex(keyHex)),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(fromHex(payload.iv)) },
    key,
    new Uint8Array(fromHex(payload.ciphertext)),
  );
  const decoded = new TextDecoder().decode(plaintext);
  return { value: JSON.parse(decoded) as T, plaintext: decoded };
}

/** SHA-256 over UTF-8 text or raw bytes, returned as 0x-prefixed hex. */
export async function sha256Hex(value: string | Uint8Array): Promise<`0x${string}`> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return toHex(new Uint8Array(digest));
}

/** Fiber reveals the invoice preimage. SHA-256(preimage) must equal the invoice hash. */
export async function verifyPreimage(preimage: string, expectedHash: string) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(preimage)) return false;
  const actual = await sha256Hex(fromHex(preimage));
  return actual.toLowerCase() === expectedHash.toLowerCase();
}
