# Submission summary

**Campaign:** Build on CKB — Fiber Testnet
**Repository:** LockerPay, built from the campaign's encrypted-data-payment starter
**Network:** CKB Fiber Testnet only; no Mainnet CKB was used

## Quests

| Quest | Delivered | Evidence |
| --- | --- | --- |
| Basic — encrypted data over Fiber | The tutorial run on Testnet: both channels `CHANNEL_READY`, an encrypted offer rejected before payment, a settled 1 CKB receipt with its payment hash, and decrypted text matching the seller's. | [`screenshots/basic/`](screenshots/basic), [`BASIC-WALKTHROUGH.md`](BASIC-WALKTHROUGH.md) |
| Advanced — pay-to-unlock demo | LockerPay: the AES key that opens a sealed pickup manifest is the Fiber invoice preimage. Repo includes the README, run instructions and a five-shot live sequence. | [`screenshots/lockerpay/`](screenshots/lockerpay), [`ADVANCED-RUN.md`](ADVANCED-RUN.md) |
| Reflection | Answers to the required question and the optional ones. | [`REFLECTION.md`](REFLECTION.md) |

## Advanced sequence

One live Testnet run, captured in order at `http://localhost:3001`:

| Step | Screenshot | Result |
| --- | --- | --- |
| 1. Operator seals locker A-17 | `01-sealed-offer.png` | Manifest encrypted (AES-256-GCM), 1 CKB invoice issued |
| 2. Customer tries without paying | `02-denied-before-payment.png` | `Access denied` — no key, ciphertext rejects |
| 3. Customer pays | `03-payment-receipt.png` | 1 CKB settled, hash `0x97df80d2…0e5b`, preimage verified |
| 4. Customer decrypts | `04-manifest-revealed.png` | SHA-256 digest matches, code `4821` revealed |
| 5. Customer opens the locker | `05-locker-open.png` | `Door released. Take your parcel.` — `BAY OPEN · COLLECTED` |

A first full run on the same day also completed end to end with payment hash `0x7664f884…33d0c`. Both runs are recorded with their invoice, digest and unlock output in [`ADVANCED-RUN.md`](ADVANCED-RUN.md).

## Verify

```sh
npm install
npm run typecheck
npm test        # 24 tests
npm run build
```

Running the demo needs two funded Testnet nodes plus the public Bottle B routing node; the steps are in the [README](../README.md#run-it).

## Safety

- No private keys, seed phrases, `.env` files or browser storage exports are in this repository.
- The AES key never leaves the browser and is only obtained through the Fiber payment preimage.
- Every payment in this submission is Testnet CKB sent to Testnet addresses.
