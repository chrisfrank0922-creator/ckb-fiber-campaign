# Submission checklist

## Status

| Item | State |
| --- | --- |
| Basic screenshots (`docs/screenshots/basic/`) | Done — live Testnet run, 20 November 2026 |
| Reflection answering the campaign questions | Drafted in `docs/REFLECTION-DRAFT.md` — reread and adjust to your voice |
| Advanced demo built and tested | Done — typecheck, 24 tests, production build |
| Advanced flow run live on Testnet | Done — see `docs/ADVANCED-RUN.md` (1 CKB settled, locker opened) |
| Advanced demo screenshots (`docs/screenshots/lockerpay/`) | Done — five shots from one live Testnet run, 20 November 2026 |
| Public GitHub repository | Local commit made in `lockerpay/` — **push and add the URL** |
| Join the Build on CKB Telegram group | **Your action** |

## Repository

- [x] `.gitignore` excludes `node_modules`, `.next`, and build caches.
- [x] Initial commit created locally.
- [x] No `.env`, private key, seed phrase, or storage export is tracked.
- [ ] Create the public GitHub repository and push (`git remote add origin … && git push -u origin main`).
- [ ] Add the final GitHub URL to the campaign form.

## Advanced quest evidence

- [x] Sealed locker / public access pass created on Testnet.
- [x] No-payment access attempt visibly rejected (`Access denied`).
- [x] Real 1 CKB Fiber Testnet payment settled, hash `0x7664f884…33d0c` (first run) and `0x97df80d2…0e5b` (the run the screenshots come from).
- [x] Manifest decrypted and its SHA-256 digest verified.
- [x] Locker keypad accepted the revealed code and released the door.
- [x] The five screenshots above captured into `docs/screenshots/lockerpay/`.
- [x] README explains what changed from the starter and how to run it locally.

To capture the sequence: run `npm run dev` with the Freebuff window visible, start Customer A and
Operator C, fund both from <https://faucet.nervos.org>, open both 500 CKB channels to Bottle B,
wait for `CHANNEL_READY`, then seal the sample locker and follow the customer panel through
rejection, payment, decryption and keypad entry. The images are saved as
`docs/screenshots/lockerpay/01-sealed-offer.png`, `02-denied-before-payment.png`,
`03-payment-receipt.png`, `04-manifest-revealed.png`, and `05-locker-open.png` (1920×1350 each).

Keep the browser pane wide (≥ 1100 px) and in the foreground: the page renders a mobile
single-column layout below that, and a backgrounded page reports `visibilityState: hidden` and
captures blank.

## Basic quest evidence

- [x] Both channels show `CHANNEL_READY`.
- [x] Encrypted offer and invoice are visible.
- [x] Decryption is rejected before payment.
- [x] Completed 1 CKB receipt includes the payment hash.
- [x] Decrypted result matches the seller's submitted text.
- [ ] Reflection answers the required question and at least two optional questions in first person.

## User actions still required

- [ ] Join the **Build on CKB** Telegram group for prize eligibility.
- [ ] Personalise `docs/REFLECTION-DRAFT.md`.
- [ ] Push the repository and submit the GitHub link with the screenshot/recording sequence.
