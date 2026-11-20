# Submission summary

**Campaign:** Build on CKB — Fiber Testnet
**Repository:** LockerPay, built from the campaign's encrypted-data-payment starter
**Network:** CKB Fiber Testnet only; no Mainnet CKB was used

## Quests

- **Basic — encrypted data over Fiber.** The tutorial run on Testnet: both channels ready, an encrypted offer rejected before payment, a settled 1 CKB receipt, decrypted text matching the seller's. Evidence: [`BASIC-WALKTHROUGH.md`](BASIC-WALKTHROUGH.md), [`screenshots/basic/`](screenshots/basic).
- **Advanced — pay-to-unlock demo.** LockerPay: the AES key that opens a sealed pickup manifest is the Fiber invoice preimage, plus the run instructions in the [README](../README.md). Evidence: [`ADVANCED-RUN.md`](ADVANCED-RUN.md), [`screenshots/lockerpay/`](screenshots/lockerpay).
- **Reflection.** [`REFLECTION.md`](REFLECTION.md).

## Advanced run values

Live Testnet run captured in the five shots under `screenshots/lockerpay/`:

- Invoice: `fibt100000…cw4trn`
- Payment hash: `0x97df80d2b7fb4827f79eff091297d6910951ad619cc9465cdaa702d854ed0e5b`
- Manifest digest: `0xb2253c551e8e972d35d2d40789ff5e1572218733735c76bbc82ef2aeb7e86811` (verified before reveal)
- Pickup code: `4821`

Full invoice string, payment details and unlock output are in [`ADVANCED-RUN.md`](ADVANCED-RUN.md).

## Verify

```sh
npm install
npm run typecheck
npm test        # 24 tests
npm run build
```

Running the demo needs two funded Testnet nodes plus the public Bottle B routing node; the steps are in the [README](../README.md#run-it).

## Safety

Every payment here is Testnet CKB to Testnet addresses. The repository contains no private keys, seed phrases, `.env` files or browser storage exports, and the AES key leaves the browser only as the payment preimage.
