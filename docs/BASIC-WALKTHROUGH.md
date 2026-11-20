# Basic quest walkthrough

1. Start Buyer A and Seller C and fund both nodes from the Testnet faucet.
2. Open both 500 CKB channels to Bottle B.
3. Wait until both opening-state lists end in `CHANNEL_READY`.
4. Seller C encrypts the report and creates a 1 CKB Fiber Testnet invoice.
5. Buyer A receives the public offer and tries to decrypt without the key. AES-GCM rejects it.
6. Buyer A pays the invoice. The receipt records amount, routing fee, total, invoice status and payment hash.
7. Buyer A uses the revealed payment preimage to decrypt the seller's text locally.

## Evidence captured

`docs/screenshots/basic/` — live Testnet run, 20 November 2026:

| File | Shows |
| --- | --- |
| `01-channels-ready.png` | Both channels `CHANNEL_READY`, live balances visible |
| `02-invoice.png` | Encrypted offer, ciphertext, 1 CKB invoice and payment hash |
| `03-decrypt-rejected.png` | Explicit AES-GCM rejection before payment |
| `04-payment-receipt.png` | 1 CKB settled, 0.001 CKB fee, 1.001 CKB total, payment hash |
| `05-decrypted-result.png` | Decrypted text matching the seller's, plus the revealed preimage |
