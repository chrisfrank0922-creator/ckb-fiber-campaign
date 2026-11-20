import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptJson, encryptJson, sha256Hex, verifyPreimage } from './lib/crypto.ts';

test('AES-256-GCM seals and opens a pickup manifest, and rejects the wrong key', async () => {
  const manifest = {
    code: '4821',
    parcel: 'Matte black camera body + 24 mm lens',
    recipient: 'Mara Chen',
    note: 'Fragile.',
  };
  const sealed = await encryptJson(manifest);
  assert.match(sealed.key, /^0x[0-9a-f]{64}$/);
  assert.match(sealed.payload.iv, /^0x[0-9a-f]{24}$/);
  assert.ok(!sealed.payload.ciphertext.includes('4821'));
  const opened = await decryptJson(sealed.payload, sealed.key);
  assert.deepEqual(opened.value, manifest);
  assert.equal(opened.plaintext, sealed.plaintext);
  await assert.rejects(decryptJson(sealed.payload, `0x${'00'.repeat(32)}`));
  await assert.rejects(decryptJson(sealed.payload, '0x1234'), /32 bytes/);
});

test('the manifest digest commits to the exact ciphertext plaintext', async () => {
  const sealed = await encryptJson({ code: '1111', parcel: 'Box', recipient: 'A', note: '' });
  assert.equal(await sha256Hex(sealed.plaintext), await sha256Hex(sealed.plaintext));
  const tampered = sealed.plaintext.replace('1111', '2222');
  assert.notEqual(await sha256Hex(tampered), await sha256Hex(sealed.plaintext));
});

test('SHA-256 matches the standard test vector', async () => {
  assert.equal(
    await sha256Hex('abc'),
    '0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('a payment preimage can be verified against the invoice hash', async () => {
  const preimage = `0x${'11'.repeat(32)}`;
  const bytes = Uint8Array.from(
    preimage.slice(2).match(/.{2}/g).map((part) => parseInt(part, 16)),
  );
  const hash = await sha256Hex(bytes);
  assert.equal(await verifyPreimage(preimage, hash), true);
  assert.equal(await verifyPreimage(preimage, `0x${'22'.repeat(32)}`), false);
  assert.equal(await verifyPreimage('not-hex', hash), false);
});
