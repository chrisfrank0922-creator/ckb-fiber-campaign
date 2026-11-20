# Reflection

Responses to the Build on CKB Fiber campaign form, from the two Testnet runs recorded in this repo. I work on CKB/Fiber, so some of this is about where the tutorial landed and where I had to read the SDK myself.

**How did it feel to have the explanations alongside each interactive step? Which format worked better, the live demo on top with the walkthrough below, or this one?**

Inline is the right default for a state-machine tutorial. Fiber's failure modes are timing and state — `AWAITING_TX_SIGNATURES` is not `CHANNEL_READY`, and a `SendPayment` can return before the invoice settles — so prose that sits next to the card it describes is read at the moment it's true. A demo on top with the explanation underneath forces you to hold six channel states in your head while scrolling, which is exactly the workload the tutorial should remove.

The one thing the inline format can't do is show the sequence as a whole, so I'd keep a collapsing "all steps" summary at the end for people who want to re-read the flow after finishing it.

## What surprised me

**Paying to unlock the report.**

The clearest part was how literally the preimage is the product. The invoice's payment hash is a commitment to a secret the seller still holds, so settlement is not "proof of payment" followed by a database lookup — it *is* the key delivery, and there is no server component that can leak it early or fail after the money moves. That is a real architectural difference from a payment-gated API, and it's the reason I built LockerPay around it instead of around a receipt check.

The bluntness of the failure before payment helped: AES-GCM rejects the ciphertext rather than returning a "locked" placeholder, so you can see the bytes are genuinely unusable, not just hidden by UI.

## Where I was unsure

**A step where the next action or its purpose wasn't obvious.**

The last-hop hint. The buyer has to name Bottle's `channel_outpoint`, fee rate and `tlc_expiry_delta` explicitly, which reads like plumbing until you realise the receiver's channel is not in the public graph — the payer has to be told the final hop rather than discover it, and `tlc_expiry_delta` is the window that keeps Bottle's liquidity committed while the TLC is in flight.

Less obvious, and worth one sentence in the tutorial: a 500 CKB channel shows roughly 400 CKB spendable because Channel V2 reserves 100 CKB for settlement. On-chain funding and channel capacity are different numbers, and only the latter constrains a payment.

## What I would build with it

**The pay-to-unlock flow.**

LockerPay is my answer: the AES-256-GCM key for the pickup manifest is the invoice preimage, so the operator can publish ciphertext and a listing without any service holding the code. I'd take the same shape to paid API responses and one-off exports — encrypt the body, commit to the key with the invoice, and let the payer's own node hand them the key. The honest limit, which the README states, is that the ciphertext proves the *data* wasn't readable early; it doesn't prove the operator shipped the physical parcel.

## A problem I ran into

**Expected, happened, resolved.**

`Peer Pubkey(...)'s feature not found, waiting for peer to send Init message` on the first channel open. The button was enabled before the peer handshake finished, so the node rejected the request — nothing was submitted, no funds moved. Re-pressing after a moment opened the channel once; the app reuses an existing channel rather than opening a second.

The sharper one was mine: `channel_outpoint` comes back from the WASM node as packed bytes (`0x` + 32-byte tx hash + little-endian u32 index), while the SDK types advertise `{ tx_hash, index }`, so `BigInt(outpoint.index)` was `undefined` and the seal threw. `lib/outpoint.ts` now accepts and validates both shapes, with tests. That class of bug — types not matching the runtime across a WASM boundary — is only findable against a live node.

## One change to the tutorial

**If I could change one thing.**

Add a short note on payment recovery, because the tutorial ends at "settled" and production starts one step earlier: if the page reloads mid-payment, the payment may still be in flight, and re-sending the same invoice can double-pay or be rejected. The right move is to re-check the stored payment hash against the node (`GetPayment`), which is what LockerPay does before offering a retry.
