# LockerPay

Paid smart-locker access on the CKB Fiber Testnet. An operator seals a pickup manifest — four-digit code, parcel, recipient, note — with AES-256-GCM, and the AES key becomes the preimage of a real 1 CKB Fiber invoice. Pay the invoice, Fiber returns the preimage, and the customer decrypts the manifest locally, enters the code, and opens the locker.

The locker and parcel are fictional. **Testnet only.**

This repository is the submission for the **Build on CKB** Fiber campaign. The Basic quest evidence and the Advanced quest demo are both here; LockerPay is the Advanced deliverable, built from the campaign's encrypted-data-payment starter.

| What the reviewer needs | Where |
| --- | --- |
| Basic quest: encrypted offer, rejection before payment, 1 CKB receipt, decrypted result | [`docs/screenshots/basic/`](docs/screenshots/basic), [`docs/BASIC-WALKTHROUGH.md`](docs/BASIC-WALKTHROUGH.md) |
| Advanced quest: five-shot sequence (offer → payment → unlock) | [`docs/screenshots/lockerpay/`](docs/screenshots/lockerpay) |
| Advanced quest: live run record with invoice, payment hashes, digest, code | [`docs/ADVANCED-RUN.md`](docs/ADVANCED-RUN.md) |
| Reflection | [`docs/REFLECTION.md`](docs/REFLECTION.md) |
| Submission summary | [`docs/SUBMISSION.md`](docs/SUBMISSION.md) |

## What it does

1. **Seal.** Operator C encrypts the manifest with a fresh AES-256-GCM key and creates a 1 CKB Fiber invoice whose payment hash commits to that key as the preimage.
2. **Share.** The public access pass carries the listing, ciphertext, IV, digest, invoice, payment hash and last-hop hint — never the code or the key.
3. **Reject.** Customer A can inspect the pass and try the locker. Without payment there is no key, and AES-GCM authentication fails.
4. **Pay and unlock.** Once the 1 CKB invoice settles, the preimage arrives, decrypts the manifest, verifies the SHA-256 digest, and supplies the code for the keypad.

## Run locally

Node.js 22.18 or newer and npm:

```sh
npm install
npm run dev
```

Open <http://localhost:3001>. The Fiber WASM runtime needs a secure context, `SharedArrayBuffer`, Web Locks and cross-origin isolation; `next.config.mjs` supplies the required headers. Use `localhost` or HTTPS, and one browser tab per saved node.

## Run the demo

1. Start Customer A and Operator C. Fund each Testnet address from <https://faucet.nervos.org> — enough for a 500 CKB channel plus the on-chain fee.
2. Open both channels to Bottle B and wait for `CHANNEL_READY` on both.
3. In Operator C, load or edit the sample locker and choose **Seal locker & create 1 CKB invoice**.
4. Send the public access pass to Customer A, inspect it, and try the locker without paying. The ciphertext must reject the substitute key.
5. Pay the invoice. Confirm the settled receipt and payment hash.
6. Decrypt the manifest, verify the digest, enter the revealed code, and open the locker.

## What changed from the starter

- Replaced the generic encrypted-report lesson with a smart-locker product flow: operator sealing, customer inspection, denied access, payment receipt, preimage verification, manifest reveal, keypad entry, and animated door states.
- Added a versioned `lockerpay-access-pass` schema with strict validation for the invoice, Bottle last-hop hint, locker dimensions, ciphertext, IV and manifest digest.
- Added AES-256-GCM manifest encryption and SHA-256 integrity verification, created and used in the browser only.
- Added safe payment recovery: attempts are recorded before submission, restored payments are checked rather than resent, and a retry requires an explicit verified failure.
- Fixed the last-hop hint against a real node. The WASM API returns a ready channel's `channel_outpoint` as packed bytes, not the `{ tx_hash, index }` object its types describe. `lib/outpoint.ts` accepts both shapes and is unit tested.
- Kept node identities and public progress separate from AES keys, decrypted manifests and pickup codes.
- Rebuilt the UI as a warm paper / industrial locker-bank layout with setup, route-liquidity, operator, customer, receipt and collection panels.
- Added unit coverage for cryptography, pass validation, manifest validation and payment safety.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

At submission: typecheck passes, the suite passes **24 tests**, and the production build emits `/` and `/icon.svg`. The full flow was run end to end on Testnet twice — see [`docs/ADVANCED-RUN.md`](docs/ADVANCED-RUN.md).

## Screenshots

**Basic quest** — `docs/screenshots/basic/`, live Testnet run, 20 November 2026:

| File | Shows |
| --- | --- |
| `01-channels-ready.png` | Channels A–B and C–B both `CHANNEL_READY`, with live balances |
| `02-invoice.png` | Encrypted offer: seller text, ciphertext, 1 CKB invoice, payment hash |
| `03-decrypt-rejected.png` | Decryption rejected before payment (AES-GCM failure) |
| `04-payment-receipt.png` | Settled 1 CKB payment, 0.001 CKB fee, 1.001 CKB total, payment hash |
| `05-decrypted-result.png` | Decrypted text matching the seller's, plus the revealed preimage |

**Advanced quest** — `docs/screenshots/lockerpay/`, five shots from one live Testnet run, in order:

| File | Shows |
| --- | --- |
| `01-sealed-offer.png` | Operator C's sealed locker A-17 and its 1 CKB invoice |
| `02-denied-before-payment.png` | Customer A's access-denied attempt before paying |
| `03-payment-receipt.png` | Settled 1 CKB payment with its payment hash |
| `04-manifest-revealed.png` | Decrypted manifest, SHA-256 digest verified, code revealed |
| `05-locker-open.png` | Keypad accepted the code, bay open, parcel collected |

## Security boundary

The AES key is generated and used in the browser and is released only through the Fiber payment preimage after settlement. The app does not persist AES keys, decrypted manifests, pickup codes or private key material in its public progress record. No private keys, seed phrases or browser storage are included in this repository. Never send Mainnet CKB to these addresses.

Payment proves the revealed key matches the invoice and opens the published ciphertext. It does not prove the operator put the advertised parcel in a physical locker; a production system would add signed listings and hardware-side verification.

## Credits

Built from the CKB Fiber encrypted-data-payment starter and the Fiber Testnet browser SDK. Tutorial reference: <https://www.fiber.world/docs/build/encrypted-data-payment>.
