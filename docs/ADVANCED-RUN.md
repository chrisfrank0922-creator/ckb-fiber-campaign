# Advanced demo — live Testnet run

Recorded on **20 November 2026** from `http://localhost:3001` with two real Fiber browser
nodes on CKB Testnet, routed through the public Bottle B node. Testnet only; no Mainnet CKB
was used.

## Setup

| Node | Role | Testnet funding address | On-chain balance after faucet |
| --- | --- | --- | --- |
| Customer A | payer | `ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqg6w23nglq2zgkulcjh7j8mvluv69l2mnsc25kjw` | 20,000 CKB |
| Operator C | seller | `ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwcw9vc6tw6c6dyhg89l3fy7zws0zztz0sqjzkn0` | 30,000 CKB |

Both nodes opened a **500 CKB channel to Bottle B** and reached `CHANNEL_READY`. With the
100 CKB Channel V2 settlement reserve, each side reported **400 CKB spendable**, and the live
route card showed **READY TO PAY**.

The first channel open from each node returned
`Invalid parameter: Peer Pubkey(...)'s feature not found, waiting for peer to send Init message`.
That is a transient handshake race in the WASM node; submitting the open again after the
peer connection completed worked, and the app reused the existing channel rather than opening
a second one.

## Sealed offer

The sample locker was sealed as Operator C:

| Field | Value |
| --- | --- |
| Locker | `A-17 · Medium · 40 × 30 × 20 cm` |
| Location | Northgate Station · Bank 02 |
| Cipher | AES-256-GCM, 376 hex characters of ciphertext |
| IV | `0x030b4e9845d582219d9751d6` |
| Manifest digest | `0xb2253c551e8e972d35d2d40789ff5e1572218733735c76bbc82ef2aeb7e86811` |
| Price | 1 CKB (`fibt1…`, Fiber Testnet invoice) |
| Payment hash | `0x7664f884d156131e1d3251f4002dad20a9df288b188166f8bd1d0f11eea33d0c` |
| Created | 2026-11-20T08:33:38Z |

The public pass carried the listing, ciphertext, IV, digest, invoice, payment hash and
last-hop hint. It carried no pickup code and no AES key.

## Before payment

Customer A inspected the pass, then chose **Try the locker without paying**. The AES-GCM
authentication failed and the app reported:

> Access denied — the pass contains no pickup code without the payment key.

## Payment

Customer A paid the 1 CKB invoice over Fiber. The node reported `Payment: Success`, the
receipt showed the settled payment with payment hash
`0x7664f884d156131e1d3251f4002dad20a9df288b188166f8bd1d0f11eea33d0c`, and the step
completed with **PAID**.

## Unlock

**Decrypt manifest** used the revealed preimage as the AES key. The app verified the plaintext
against the published digest and reported:

> Manifest decrypted. SHA-256 digest matches the published pass.

The revealed pickup code was entered on the locker terminal keypad, which released the door:

> Locker A-17 unlocked. Collect your parcel. — Door released. Take your parcel.
> PARCEL A-17 · COLLECTED · BAY OPEN · COLLECTED

## Bug found and fixed during this run

The first seal attempt failed with `Cannot convert undefined to a BigInt`. The WASM node
returns `channel_outpoint` as packed bytes (`0x` + 32-byte tx hash + little-endian u32 index,
72 hex characters), while the SDK TypeScript types describe it as `{ tx_hash, index }`.
`lib/locker.ts` assumed the object shape, so `BigInt(outpoint.index)` received `undefined`.

The packing now lives in `lib/outpoint.ts`, accepts both shapes, validates them, and is
covered by `outpoint.test.mjs` (4 tests). This was only discoverable by running the demo
against a real node.
