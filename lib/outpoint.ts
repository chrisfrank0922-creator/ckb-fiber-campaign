/**
 * The WASM node reports a ready channel's outpoint as packed bytes:
 * 32-byte transaction hash followed by a little-endian u32 output index.
 * The SDK types describe the same value as { tx_hash, index }, and older
 * builds return one shape or the other, so both are accepted here.
 */
export type ChannelOutpoint = string | { tx_hash: string; index: string };

export function packChannelOutpoint(outpoint: ChannelOutpoint): `0x${string}` {
  if (typeof outpoint === 'string') {
    const packed = outpoint.trim();
    if (!/^0x[0-9a-f]{72}$/i.test(packed)) {
      throw new Error('The channel outpoint is malformed.');
    }
    return packed.toLowerCase() as `0x${string}`;
  }
  const txHash = outpoint.tx_hash.trim();
  if (!/^0x[0-9a-f]{64}$/i.test(txHash)) {
    throw new Error('The channel outpoint transaction hash is malformed.');
  }
  const index = BigInt(outpoint.index);
  if (index > 0xffff_ffffn) throw new Error('The channel outpoint index exceeds u32.');
  const indexBytes = index
    .toString(16)
    .padStart(8, '0')
    .match(/../g)!
    .reverse()
    .join('');
  return `0x${txHash.slice(2)}${indexBytes}`.toLowerCase() as `0x${string}`;
}
