import assert from 'node:assert/strict';
import test from 'node:test';
import { bottle, lockerSizes } from './lib/constants.ts';
import {
  assertLockerDraft,
  buildManifest,
  parseManifest,
  shortHex,
} from './lib/manifest.ts';
import { parseAccessPass } from './lib/access-pass.ts';
import { sampleLocker } from './lib/sample.ts';

const hash = `0x${'a'.repeat(64)}`;
const validPass = {
  version: 1,
  kind: 'lockerpay-access-pass',
  locker: {
    name: ' A-17 ',
    location: 'Northgate Station · Bank 02',
    size: 'Medium',
    dimensions: lockerSizes.Medium,
  },
  priceCkb: 1,
  cipher: 'AES-256-GCM',
  ciphertext: '0xdeadbeef',
  iv: `0x${'c'.repeat(24)}`,
  contentHash: `0x${'b'.repeat(64)}`,
  invoice: 'fibt1example',
  paymentHash: hash,
  lastHop: {
    pubkey: bottle.pubkey,
    channel_outpoint: `0x${'d'.repeat(72)}`,
    fee_rate: '0x1',
    tlc_expiry_delta: '0x3c',
  },
  createdAt: '2026-11-20T10:00:00.000Z',
};

test('parses and normalizes a version 1 access pass', () => {
  const parsed = parseAccessPass(JSON.stringify(validPass));
  assert.equal(parsed.locker.name, 'A-17');
  assert.equal(parsed.priceCkb, 1);
  assert.equal(parsed.contentHash, validPass.contentHash);
  assert.equal(parsed.iv, validPass.iv);
  assert.equal(parsed.lastHop.fee_rate, '0x1');
});

test('rejects passes with the wrong version, kind, or cipher', () => {
  assert.throws(() => parseAccessPass(JSON.stringify({ ...validPass, version: 2 })), /version 1/);
  assert.throws(
    () => parseAccessPass(JSON.stringify({ ...validPass, kind: 'fiberbrief-offer' })),
    /version 1/,
  );
  assert.throws(
    () => parseAccessPass(JSON.stringify({ ...validPass, cipher: 'AES-128' })),
    /AES-256-GCM/,
  );
});

test('rejects malformed paid fields before the customer pays', () => {
  assert.throws(() => parseAccessPass(JSON.stringify({ ...validPass, iv: '0x1234' })), /12 bytes/);
  assert.throws(() => parseAccessPass(JSON.stringify({ ...validPass, priceCkb: 2 })), /1 CKB/);
  assert.throws(
    () => parseAccessPass(JSON.stringify({ ...validPass, contentHash: 'nope' })),
    /hexadecimal/,
  );
  assert.throws(
    () =>
      parseAccessPass(
        JSON.stringify({ ...validPass, locker: { ...validPass.locker, dimensions: 'huge' } }),
      ),
    /dimensions/,
  );
  assert.throws(
    () =>
      parseAccessPass(
        JSON.stringify({
          ...validPass,
          lastHop: { ...validPass.lastHop, pubkey: `0x${'e'.repeat(66)}` },
        }),
      ),
    /Bottle/,
  );
  assert.throws(() => parseAccessPass('{'), /valid JSON/);
});

test('locker drafts enforce the public listing and the four-digit code', () => {
  assert.doesNotThrow(() => assertLockerDraft(sampleLocker));
  assert.throws(
    () => assertLockerDraft({ ...sampleLocker, code: '12a4' }),
    /four digits/,
  );
  assert.throws(() => assertLockerDraft({ ...sampleLocker, name: 'A' }), /label/);
  assert.throws(() => assertLockerDraft({ ...sampleLocker, location: 'x' }), /location/);
  assert.throws(() => assertLockerDraft({ ...sampleLocker, parcel: ' ' }), /parcel/);
  assert.throws(() => assertLockerDraft({ ...sampleLocker, note: 'x'.repeat(201) }), /note/);
});

test('the manifest keeps only private pickup fields and trims whitespace', () => {
  const manifest = buildManifest({
    ...sampleLocker,
    parcel: '  Camera body  ',
    recipient: '  Mara Chen ',
    note: '  Fragile.  ',
  });
  assert.deepEqual(Object.keys(manifest).sort(), ['code', 'note', 'parcel', 'recipient']);
  assert.equal(manifest.code, '4821');
  assert.equal(manifest.parcel, 'Camera body');
  assert.equal(manifest.recipient, 'Mara Chen');
  assert.equal(manifest.note, 'Fragile.');
});

test('parseManifest refuses incomplete decrypted data', () => {
  const good = { code: '4821', parcel: 'Camera', recipient: 'Mara', note: '' };
  assert.deepEqual(parseManifest(good), good);
  assert.throws(() => parseManifest({ ...good, code: '999' }), /code/);
  assert.throws(() => parseManifest({ ...good, parcel: '' }), /parcel/);
  assert.throws(() => parseManifest({ ...good, recipient: '' }), /recipient/);
  assert.throws(() => parseManifest(null), /not an object/);
});

test('shortHex elides the middle of long identifiers', () => {
  assert.equal(shortHex(hash, 6, 4), '0xaaaa…aaaa');
});
