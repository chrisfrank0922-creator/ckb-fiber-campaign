# Reflection

Answers to the Build on CKB campaign form, from the runs in this repo.

## Required — explanations next to each step

**How did it feel having the explanations alongside each step? Which format worked better, the live demo on top with the walkthrough below, or this one?**

The inline version, easily. I only had to look at the card in front of me to know why it mattered, and the channel states are confusing enough that I would have lost track if the text were somewhere else on the page. I did miss being able to see the whole flow at once, so a collapsed summary at the end would help.

I can't honestly compare it to the older layout because this was my first Fiber tutorial, but I would pick inline again.

## What surprised me

**Paying to unlock the report.**

I expected the payment to just prove I had paid, and then something on the server would unlock the content. Instead the key is the preimage itself, so settlement is what hands it over and there is no step where the seller can still cheat. The failed decryption before paying helped too. It wasn't a "locked" message, the ciphertext genuinely didn't open.

## Where I was unsure

**A step where the next action wasn't obvious.**

The last-hop hint. I didn't understand why I had to pass Bottle's outpoint and expiry delta, until it was explained that the seller's channel isn't in the public graph so the payer has to be told the final hop.

Also worth saying in the tutorial: a 500 CKB channel only gives you about 400 spendable, because 100 CKB is reserved. I checked my balance twice before working that out.

## What I would build with it

**The pay-to-unlock flow.**

LockerPay, the Advanced entry here. Beyond that, paid API responses or exports: encrypt the body, make the key the invoice preimage, and the payer's own node gets them the key. It won't prove the seller actually shipped anything, but it does prove nobody could read the data early.

## A problem I ran into

**Expected, happened, resolved.**

The first channel open failed with a peer feature error because the node hadn't finished its handshake yet. Nothing was submitted and no funds moved, so pressing open again after a moment worked.

The one that actually cost me time was the seal throwing `Cannot convert undefined to a BigInt`. The node returns `channel_outpoint` as packed bytes but the SDK types say `{ tx_hash, index }`, so I had to handle both shapes. Only showed up against a live node.

## One change to the tutorial

**If I could change one thing.**

Say what to do if the page reloads mid-payment. Re-sending can double-pay, so the right move is to check the payment hash you stored first. The tutorial stops at "settled", but that is where things get interesting.
