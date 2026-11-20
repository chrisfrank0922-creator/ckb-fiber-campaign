import type { Channel, FiberBrowserNode } from '@fiber-pay/sdk/browser';
import { lockerSizes, priceShannons } from './constants';
import { encryptJson, sha256Hex } from './crypto';
import { buildManifest, assertLockerDraft, type LockerDraft } from './manifest';
import { packChannelOutpoint } from './outpoint';
import type { LockerAccessPass } from './access-pass';

function normalizeHexQuantity(value: string) {
  return `0x${BigInt(value).toString(16)}` as `0x${string}`;
}

/**
 * Seals the pickup manifest (code, parcel, recipient, note) with a fresh AES key,
 * pins its SHA-256 digest, and creates a 1 CKB Fiber invoice whose preimage is
 * that key. The pass contains only public listing data and ciphertext.
 */
export async function sealLocker(
  operator: FiberBrowserNode,
  operatorChannel: Channel,
  draft: LockerDraft,
) {
  assertLockerDraft(draft);
  if (!operatorChannel.channel_outpoint) {
    throw new Error('The operator channel does not have a confirmed outpoint yet.');
  }

  const manifest = buildManifest(draft);
  const encrypted = await encryptJson(manifest);
  const contentHash = await sha256Hex(encrypted.plaintext);

  const invoice = await operator.newInvoice({
    amount: priceShannons,
    currency: 'Fibt',
    payment_preimage: encrypted.key,
    hash_algorithm: 'sha256',
    allow_trampoline_routing: true,
    description: `LockerPay: ${draft.name.trim()}`.slice(0, 120),
    expiry: '0xe10', // 1 hour
  });

  const pass: LockerAccessPass = {
    version: 1,
    kind: 'lockerpay-access-pass',
    locker: {
      name: draft.name.trim(),
      location: draft.location.trim(),
      size: draft.size,
      dimensions: lockerSizes[draft.size],
    },
    priceCkb: 1,
    cipher: 'AES-256-GCM',
    ciphertext: encrypted.payload.ciphertext,
    iv: encrypted.payload.iv,
    contentHash,
    invoice: invoice.invoice_address,
    paymentHash: invoice.invoice.data.payment_hash,
    lastHop: {
      pubkey: operatorChannel.pubkey,
      channel_outpoint: packChannelOutpoint(operatorChannel.channel_outpoint),
      fee_rate: normalizeHexQuantity(operatorChannel.tlc_fee_proportional_millionths),
      tlc_expiry_delta: normalizeHexQuantity(operatorChannel.tlc_expiry_delta),
    },
    createdAt: new Date().toISOString(),
  };

  return {
    pass,
    json: JSON.stringify(pass, null, 2),
  };
}
