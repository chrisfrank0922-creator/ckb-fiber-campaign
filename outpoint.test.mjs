import assert from 'node:assert/strict';
import test from 'node:test';
import { packChannelOutpoint } from './lib/outpoint.ts';

const txHash = `0x${'ab'.repeat(32)}`;

test('accepts the packed outpoint the WASM node returns', () => {
  const packed = `${txHash}00000000`;
  assert.equal(packChannelOutpoint(packed), packed);
});

test('normalizes a packed outpoint to lowercase and keeps the index bytes', () => {
  const packed = `0x${'AB'.repeat(32)}01000000`;
  assert.equal(packChannelOutpoint(packed), packed.toLowerCase());
});

test('packs the { tx_hash, index } shape into the same layout', () => {
  assert.equal(packChannelOutpoint({ tx_hash: txHash, index: '0x0' }), `${txHash}00000000`);
  assert.equal(
    packChannelOutpoint({ tx_hash: txHash, index: '0x1' }),
    `${txHash}01000000`,
  );
  assert.equal(
    packChannelOutpoint({ tx_hash: txHash, index: '0x10' }),
    `${txHash}10000000`,
  );
});

test('rejects malformed outpoints instead of packing undefined', () => {
  assert.throws(() => packChannelOutpoint(`0x${'ab'.repeat(31)}`), /malformed/);
  assert.throws(() => packChannelOutpoint({ tx_hash: '0x1234', index: '0x0' }), /malformed/);
  assert.throws(
    () => packChannelOutpoint({ tx_hash: txHash, index: '0x100000000' }),
    /exceeds u32/,
  );
});
