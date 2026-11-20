# Reflection

Answers to the Build on CKB Fiber campaign questions, from the runs recorded in this repository.

## Required — explanations alongside each step

**How did it feel to have the explanations alongside each interactive step? Which format worked better — the older live-demo-on-top layout or the inline walkthrough — and why?**

Inline was better for me. The explanation sat directly above the card I was acting on, so when the channel-opening card was in front of me it told me why both A and C needed a channel to Bottle B and what each opening state meant. I never had to scroll away from the button I was about to press, which is where I usually lose the thread in a walkthrough.

I can't compare fairly from experience, because this was my first Fiber tutorial run end to end. But inline removes the main cost of a long walkthrough — switching between instructions and the app — and I would choose it again over a demo at the top with all the reading underneath.

## What surprised me

**Paying to unlock the report.**

Two things. The rejection before payment was blunt: AES-GCM failed, rather than showing a vague "content locked" message, so the ciphertext really was useless without the seller's key. And the payment itself turned out to be the key handover — the invoice payment hash commits to a secret the seller still holds, and settlement is what releases it. I had assumed paying only moved money. Watching the preimage appear and then open the exact bytes I had already failed to decrypt is what made the design click.

## Where I was unsure

**A step where I did not know what to do next or why it mattered.**

Waiting for `CHANNEL_READY`. My funding balance appeared quickly, so it was tempting to treat the channel as usable while it was still in `AWAITING_TX_SIGNATURES`. The other one was the last-hop hint: I did not see why the buyer needs Bottle's outpoint, fee rate and expiry delta until the explanation made clear the buyer is routing through Bottle and has to name that final channel explicitly instead of discovering it.

## What I would build with it

**The pay-to-unlock flow.**

LockerPay, the Advanced entry here: an operator seals a pickup manifest behind a 1 CKB invoice, and the customer cannot open it before paying. The same pattern fits any response body that should be readable only after payment — a paid API response, a one-off data export, a report behind a single invoice — encrypted with the key that becomes the preimage.

## One change to the tutorial

**If I could change one thing.**

A short note near the channel cards saying that the on-chain funding balance and the channel's spendable balance are different numbers, and that nothing is spendable before `CHANNEL_READY`. That is the one point where I had to reason about the state machine instead of being told what to expect.

## A problem I ran into

**Expected, happened, resolved.**

The first channel open failed with `Peer Pubkey(...)'s feature not found, waiting for peer to send Init message`. I expected it to open as soon as the button was enabled, but the node had not finished its handshake with Bottle, so the request was rejected before anything was submitted. I waited a moment and pressed open again; it reached `CHANNEL_READY` and the app reused the existing channel instead of opening a second one. Nothing had moved on-chain, so the fix was patience, not a new channel.
