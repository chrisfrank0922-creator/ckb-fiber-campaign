# Basic quest walkthrough

## Proof sequence

1. Start Buyer A and Seller C and fund both nodes.
2. Open both 500 CKB channels to Bottle B.
3. Confirm both opening-state lists end in `CHANNEL_READY`.
4. Seller C encrypts the report and creates a 1 CKB Fiber Testnet invoice.
5. Buyer A receives the public offer and attempts decryption without the key. AES-GCM rejects the substitute key.
6. Buyer A pays the invoice. The receipt records the 1 CKB amount, the routing fee, total paid, invoice status, and payment hash.
7. Buyer A uses the revealed payment preimage to decrypt the exact seller text locally.

The captured screenshot sequence is in `docs/screenshots/basic/`.

## Evidence captured

- Both channels: `CHANNEL_READY`, with the live channel balances visible.
- Encrypted offer and invoice: seller text, ciphertext, 1 CKB amount, and invoice payment hash.
- Rejected decryption: explicit AES-GCM rejection before payment.
- Settled receipt: completed payment, 1 CKB amount, 0.001 CKB routing fee, 1.001 CKB total, and payment hash.
- Decrypted result: seller text matches the submitted text and includes the revealed preimage.

Do not include browser profiles, local storage exports, private keys, seed phrases, or raw node credentials in the submission.
