# LockerPay

Paid smart-locker access on the CKB Fiber Testnet. An operator seals a pickup manifest (code, parcel, recipient, note) with AES-256-GCM, and that key is the preimage of a 1 CKB Fiber invoice, so the manifest only decrypts after payment.

The locker is fictional. **Testnet only.** This repo is the **Build on CKB** Fiber campaign submission; LockerPay is the Advanced deliverable, built from the campaign's encrypted-data-payment starter.

| What to look at | Where |
| --- | --- |
| Basic quest: offer, rejection before payment, 1 CKB receipt, decrypted result | [`docs/screenshots/basic/`](docs/screenshots/basic), [`docs/BASIC-WALKTHROUGH.md`](docs/BASIC-WALKTHROUGH.md) |
| Advanced quest: five-shot sequence | [`docs/screenshots/lockerpay/`](docs/screenshots/lockerpay) |
| Live run record: invoices, payment hashes, digest, code | [`docs/ADVANCED-RUN.md`](docs/ADVANCED-RUN.md) |
| Reflection | [`docs/REFLECTION.md`](docs/REFLECTION.md) |
| Submission summary | [`docs/SUBMISSION.md`](docs/SUBMISSION.md) |

## How it works

1. **Seal.** Operator C encrypts the manifest and issues a 1 CKB invoice whose payment hash commits to the key.
2. **Share.** The public pass carries the listing, ciphertext, IV, digest, invoice and last-hop hint, never the code or key.
3. **Reject.** Customer A inspects the pass and tries the locker. No payment means no key, so AES-GCM rejects the ciphertext.
4. **Pay and unlock.** Settlement releases the preimage; the manifest decrypts, its SHA-256 digest is checked, and the code opens the door.

## Run it

Node.js 22.18+ and npm:

```sh
npm install
npm run dev
```

Then open <http://localhost:3001>. The Fiber WASM runtime needs a secure context, `SharedArrayBuffer`, Web Locks and cross-origin isolation (`next.config.mjs` sets the headers). Use `localhost` or HTTPS, one tab per saved node.

1. Start Customer A and Operator C, and fund both addresses from <https://faucet.nervos.org> — enough for a 500 CKB channel plus the on-chain fee. 100 CKB of that is reserved, so a 500 CKB channel is about 400 CKB spendable.
2. Open both channels to Bottle B and wait for `CHANNEL_READY` on each.
3. In Operator C, seal the sample locker: **Seal locker & create 1 CKB invoice**.
4. Send the pass to Customer A, inspect it, and try the locker without paying — the substitute key must be rejected.
5. Pay the invoice and confirm the settled receipt and payment hash.
6. Decrypt the manifest, verify the digest, enter the code, open the locker.

## What changed from the starter

- The encrypted-report lesson became a locker product flow: sealing, inspection, denied access, receipt, preimage check, reveal, keypad, door states.
- A versioned `lockerpay-access-pass` schema with strict validation of the invoice, hop hint, locker dimensions, ciphertext, IV and digest.
- Manifest encryption plus SHA-256 verification, all in the browser.
- Payment recovery: attempts are recorded before submission, restored payments are checked instead of resent, and retries need a verified failure.
- Fixed the hop hint against a real node. `channel_outpoint` comes back as packed bytes, not the `{ tx_hash, index }` the SDK types describe; `lib/outpoint.ts` handles both and is tested.
- Keys, decrypted manifests and codes stay out of the persisted progress record. Tests cover crypto, pass and manifest validation, and payment safety.

## Evidence

`npm run typecheck`, `npm test` (**24 tests**) and `npm run build` pass at submission, and the flow ran end to end on Testnet twice. Screenshots are from live runs on 20 November 2026.

**Basic quest** — `docs/screenshots/basic/`

| File | Shows |
| --- | --- |
| `01-channels-ready.png` | A–B and C–B both `CHANNEL_READY`, live balances |
| `02-invoice.png` | Encrypted offer, ciphertext, 1 CKB invoice, payment hash |
| `03-decrypt-rejected.png` | Decryption rejected before payment |
| `04-payment-receipt.png` | 1 CKB settled, 0.001 CKB fee, 1.001 CKB total, payment hash |
| `05-decrypted-result.png` | Decrypted text matching the seller's, plus the preimage |

**Advanced quest** — `docs/screenshots/lockerpay/`, one run, in order

| File | Shows |
| --- | --- |
| `01-sealed-offer.png` | Sealed locker A-17 and its 1 CKB invoice |
| `02-denied-before-payment.png` | Access denied before paying |
| `03-payment-receipt.png` | Settled 1 CKB payment with its hash |
| `04-manifest-revealed.png` | Manifest decrypted, digest verified, code shown |
| `05-locker-open.png` | Keypad accepted the code, bay open, parcel collected |

## Limits

The AES key is generated in the browser and only released by the payment preimage; nothing in the repo holds keys, codes or browser storage. Never send Mainnet CKB to these addresses.

Payment proves the revealed key matches the invoice and opens the ciphertext. It does not prove the operator put the parcel in a physical locker — that would need signed listings and hardware verification.

## Credits

Built from the CKB Fiber encrypted-data-payment starter and the Fiber Testnet browser SDK. Tutorial: <https://www.fiber.world/docs/build/encrypted-data-payment>.
