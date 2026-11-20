# LockerPay

LockerPay is a paid smart-locker access demo built on the CKB Fiber Testnet. An operator seals a pickup manifest—four-digit code, parcel, recipient, and note—with AES-256-GCM. The AES key becomes the preimage of a real 1 CKB Fiber invoice. After the customer pays, Fiber returns the preimage; the customer verifies it, decrypts the manifest locally, enters the code, and opens the locker.

The locker and parcel are fictional. This project is **Testnet only**.

## Campaign submission

This repository is one submission for the **Build on CKB** Fiber campaign: the Basic quest evidence and the Advanced quest demo live together here, with LockerPay as the Advanced deliverable.

| Quest | Deliverable |
| --- | --- |
| Basic — encrypted data over Fiber | Tutorial run on Testnet: both channels `CHANNEL_READY`, an encrypted offer rejected before payment, a settled 1 CKB receipt with its payment hash, and the decrypted text matching the seller's. Screenshots in [`docs/screenshots/basic/`](docs/screenshots/basic), walkthrough in [`docs/BASIC-WALKTHROUGH.md`](docs/BASIC-WALKTHROUGH.md). |
| Advanced — pay-to-unlock demo | LockerPay, the app in this repo: the AES key that opens a sealed pickup manifest is the Fiber invoice preimage. Five-shot sequence in [`docs/screenshots/lockerpay/`](docs/screenshots/lockerpay), live run record in [`docs/ADVANCED-RUN.md`](docs/ADVANCED-RUN.md). |
| Reflection | [`docs/REFLECTION-DRAFT.md`](docs/REFLECTION-DRAFT.md) |
| Submission status | [`docs/SUBMISSION-CHECKLIST.md`](docs/SUBMISSION-CHECKLIST.md) |

## Run locally

Use Node.js 22.18 or newer and npm:

```sh
npm install
npm run dev
```

Open <http://localhost:3001>. The Fiber WASM runtime needs a secure context, `SharedArrayBuffer`, Web Locks, and cross-origin isolation. `next.config.mjs` supplies the required isolation headers. Use `localhost` or HTTPS and keep one browser tab per saved node.

## Run the demo

1. Start Customer A and Operator C.
2. Copy each Testnet funding address to the Nervos faucet and request enough CKB for a 500 CKB channel plus the on-chain fee.
3. Open both channels to Bottle B and wait for `CHANNEL_READY`.
4. In Operator C, edit or load the sample locker and select **Seal locker & create 1 CKB invoice**.
5. Send the public access pass to Customer A, inspect it, and try the locker without paying. The ciphertext must reject the substitute key.
6. Pay the 1 CKB Fiber invoice. Confirm the receipt and payment hash.
7. Decrypt the manifest, verify the SHA-256 digest, enter the revealed four-digit code, and open the locker.

The public pass contains the listing, ciphertext, IV, digest, invoice, payment hash, and last-hop hint. It does not contain the pickup code or AES key.

## What changed from the encrypted-data starter

- Replaced the generic encrypted-report lesson with the LockerPay smart-locker product flow.
- Added a versioned `lockerpay-access-pass` schema with strict validation for the Testnet invoice, Bottle last-hop hint, locker dimensions, ciphertext, IV, and manifest digest.
- Added AES-256-GCM manifest encryption and SHA-256 integrity verification.
- Added operator sealing, customer inspection, no-payment rejection, payment receipt, preimage verification, manifest reveal, keypad entry, and animated locker-door states.
- Added safe payment recovery: attempts are recorded before submission, restored payments are checked instead of resent, and retries require an explicit verified failure.
- Fixed the last-hop hint against the real node: the WASM API returns a ready channel's `channel_outpoint` as packed bytes, not the `{ tx_hash, index }` object its types describe. `lib/outpoint.ts` accepts both shapes and is unit tested.
- Added browser-only progress handling that keeps node identities and public progress separate from AES keys, decrypted manifests, and pickup codes.
- Reworked the UI into a warm paper / industrial locker-bank design with responsive setup, route-liquidity, operator, customer, receipt, and collection panels.
- Added unit coverage for cryptography, pass validation, manifest validation, and payment-safety behavior.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

At the time of submission:

- TypeScript typecheck passes.
- Test suite passes: **24 tests**.
- Production build passes with the `/` route and `/icon.svg`.
- A live Fiber Testnet run was completed for the Basic encrypted-data lesson: both channels reached `CHANNEL_READY`, a 1 CKB payment settled, and the decrypted seller text matched exactly.
- The Advanced flow was run end to end against real Testnet nodes: both channels reached `CHANNEL_READY`, the access pass was rejected before payment, the 1 CKB invoice settled (`0x7664f884…33d0c`), the manifest digest verified, and the revealed code opened locker A-17. Details in [`docs/ADVANCED-RUN.md`](docs/ADVANCED-RUN.md).
- The five Advanced screenshots below were captured from a later live Testnet run of the same flow (invoice `fibt100000…cw4trn`, payment hash `0x97df80d2…0e5b`, code `4821`).

## Security boundary

The browser creates and uses the AES key locally. The key is only released through the Fiber payment preimage after settlement. The application does not save AES keys, decrypted manifests, pickup codes, or private key material in its public progress record. Never submit private keys, seed phrases, or browser storage. Never send Mainnet CKB to these addresses.

Payment proves that the revealed key matches the invoice and opens the published ciphertext. It does not prove that the operator put the advertised parcel in a physical locker; a production system would add signed listings and hardware-side verification.

## Screenshots

Basic quest evidence is in `docs/screenshots/basic/`, captured from a live Testnet run of the tutorial on 20 November 2026:

| File | Shows |
| --- | --- |
| `01-channels-ready.png` | Channel A–B and C–B both at `CHANNEL_READY`, with live balances |
| `02-invoice.png` | Seller's encrypted report, ciphertext, 1 CKB invoice and payment hash |
| `03-decrypt-rejected.png` | Offer JSON and the explicit AES-GCM `Decryption rejected` message |
| `04-payment-receipt.png` | Settled payment: 1 CKB, 0.001 CKB fee, 1.001 CKB total, payment hash |
| `05-decrypted-result.png` | Decrypted report matching the seller's text, plus the revealed preimage |

The Advanced flow is documented in [`docs/ADVANCED-RUN.md`](docs/ADVANCED-RUN.md), including invoices, payment hashes, manifest digest and unlock result. The screen sequence in `docs/screenshots/lockerpay/` was captured from one live Testnet run, in this order:

| File | Shows |
| --- | --- |
| `01-sealed-offer.png` | Operator C's sealed locker A-17 and its 1 CKB invoice |
| `02-denied-before-payment.png` | Customer A's access-denied attempt before paying |
| `03-payment-receipt.png` | Settled 1 CKB payment with the payment hash |
| `04-manifest-revealed.png` | Decrypted manifest with the verified SHA-256 digest |
| `05-locker-open.png` | Locker terminal accepting the code with the bay open |

## Credits

Built from the CKB Fiber encrypted-data-payment starter and Fiber Testnet browser SDK. The Fiber tutorial reference is <https://www.fiber.world/docs/build/encrypted-data-payment>.
