import { bottle, lockerSizes, priceCkb, type LockerSize } from './constants.ts';
import { isLockerSize, MAX_LOCATION, MAX_NAME } from './manifest.ts';

export type LockerAccessPass = {
  version: 1;
  kind: 'lockerpay-access-pass';
  locker: {
    name: string;
    location: string;
    size: LockerSize;
    dimensions: string;
  };
  priceCkb: typeof priceCkb;
  cipher: 'AES-256-GCM';
  ciphertext: `0x${string}`;
  iv: `0x${string}`;
  /** SHA-256 of the exact JSON plaintext placed inside the ciphertext. */
  contentHash: `0x${string}`;
  invoice: string;
  paymentHash: `0x${string}`;
  lastHop: {
    pubkey: `0x${string}`;
    channel_outpoint: `0x${string}`;
    fee_rate: `0x${string}`;
    tlc_expiry_delta: `0x${string}`;
  };
  createdAt: string;
};

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeHexBytes(value: unknown, label: string, bytes?: number) {
  if (typeof value !== 'string') throw new Error(`${label} is missing.`);
  const body = value.trim().replace(/^0x/i, '');
  if (!body || body.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(body)) {
    throw new Error(`${label} must be hexadecimal bytes.`);
  }
  if (bytes !== undefined && body.length !== bytes * 2) {
    throw new Error(`${label} must be ${bytes} bytes.`);
  }
  return `0x${body.toLowerCase()}` as `0x${string}`;
}

function normalizeHexQuantity(value: unknown, label: string) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return `0x${value.toString(16)}` as `0x${string}`;
  }
  if (typeof value !== 'string') throw new Error(`${label} is missing.`);
  const normalized = value.trim();
  if (/^0x[0-9a-f]+$/i.test(normalized)) {
    return `0x${BigInt(normalized).toString(16)}` as `0x${string}`;
  }
  if (/^\d+$/.test(normalized)) {
    return `0x${BigInt(normalized).toString(16)}` as `0x${string}`;
  }
  throw new Error(`${label} must be a non-negative integer.`);
}

function packOutpoint(txHash: `0x${string}`, index: `0x${string}`) {
  const indexValue = BigInt(index);
  if (indexValue > 0xffff_ffffn) throw new Error('Last-hop output index exceeds u32.');
  const indexBytes = indexValue
    .toString(16)
    .padStart(8, '0')
    .match(/../g)
    ?.reverse()
    .join('');
  return `0x${txHash.slice(2)}${indexBytes}` as `0x${string}`;
}

function normalizeOutpoint(value: unknown): LockerAccessPass['lastHop']['channel_outpoint'] {
  if (isJsonObject(value)) {
    return packOutpoint(
      normalizeHexBytes(value.tx_hash ?? value.txHash, 'Last-hop transaction hash', 32),
      normalizeHexQuantity(value.index, 'Last-hop output index'),
    );
  }
  if (typeof value === 'string' && /^0x[0-9a-f]{72}$/i.test(value.trim())) {
    return value.trim().toLowerCase() as `0x${string}`;
  }
  throw new Error('Last-hop channel outpoint is missing or malformed.');
}

function normalizeLastHop(value: unknown): LockerAccessPass['lastHop'] {
  if (!isJsonObject(value)) throw new Error('Last-hop hint is missing.');
  if (normalizeHexBytes(value.pubkey, 'Last-hop public key', 33) !== bottle.pubkey) {
    throw new Error('Last-hop hint must identify Bottle.');
  }
  return {
    pubkey: normalizeHexBytes(value.pubkey, 'Last-hop public key', 33),
    channel_outpoint: normalizeOutpoint(value.channel_outpoint ?? value.channelOutpoint),
    fee_rate: normalizeHexQuantity(value.fee_rate ?? value.feeRate, 'Last-hop fee rate'),
    tlc_expiry_delta: normalizeHexQuantity(
      value.tlc_expiry_delta ?? value.tlcExpiryDelta,
      'Last-hop expiry delta',
    ),
  };
}

export function parseAccessPass(value: string): LockerAccessPass {
  let pass: unknown;
  try {
    pass = JSON.parse(value);
  } catch {
    throw new Error('That is not valid JSON. Paste the complete access pass.');
  }
  if (!isJsonObject(pass) || pass.version !== 1 || pass.kind !== 'lockerpay-access-pass') {
    throw new Error('Unsupported pass. LockerPay expects a version 1 lockerpay-access-pass.');
  }
  if (pass.cipher !== 'AES-256-GCM') {
    throw new Error('Unsupported cipher. LockerPay expects AES-256-GCM.');
  }
  if (!isJsonObject(pass.locker)) throw new Error('The pass is missing its locker listing.');

  const name = typeof pass.locker.name === 'string' ? pass.locker.name.trim() : '';
  const location = typeof pass.locker.location === 'string' ? pass.locker.location.trim() : '';
  if (name.length < 2 || name.length > MAX_NAME) throw new Error('The locker label is malformed.');
  if (location.length < 3 || location.length > MAX_LOCATION) {
    throw new Error('The locker location is malformed.');
  }
  if (!isLockerSize(pass.locker.size)) throw new Error('The locker size is malformed.');
  if (pass.locker.dimensions !== lockerSizes[pass.locker.size]) {
    throw new Error('The locker dimensions do not match its size.');
  }
  if (pass.priceCkb !== priceCkb) {
    throw new Error(`This demo only accepts ${priceCkb} CKB locker passes.`);
  }
  if (typeof pass.invoice !== 'string' || !pass.invoice.toLowerCase().startsWith('fibt')) {
    throw new Error('The access pass is missing a Fiber Testnet invoice.');
  }
  if (typeof pass.createdAt !== 'string' || Number.isNaN(Date.parse(pass.createdAt))) {
    throw new Error('The pass creation time is missing or malformed.');
  }

  return {
    version: 1,
    kind: 'lockerpay-access-pass',
    locker: {
      name,
      location,
      size: pass.locker.size,
      dimensions: lockerSizes[pass.locker.size],
    },
    priceCkb,
    cipher: 'AES-256-GCM',
    ciphertext: normalizeHexBytes(pass.ciphertext, 'Ciphertext'),
    iv: normalizeHexBytes(pass.iv, 'AES-GCM IV', 12),
    contentHash: normalizeHexBytes(pass.contentHash, 'Manifest digest', 32),
    invoice: pass.invoice,
    paymentHash: normalizeHexBytes(pass.paymentHash, 'Invoice payment hash', 32),
    lastHop: normalizeLastHop(pass.lastHop),
    createdAt: pass.createdAt,
  };
}
