# Campaign reflection

These answers are written in first person for the campaign form. Read them once and adjust any detail that does not match your own run before submitting — the wording should sound like you.

## Required question

**How did it feel to have the explanations alongside each interactive step? If you've tried a previous Fiber tutorial with the live demo at the top and the walkthrough below, which format worked better for you, and why?**

Having the explanation attached to the step I was actually performing made the whole flow feel much calmer than reading a long walkthrough first and then trying to remember it. When the channel-opening card was on screen, the text directly above it explained why Buyer A and Seller C both need a channel to Bottle B, and what each of the six opening states means. I never had to scroll away to look something up, so I always knew why the button in front of me mattered. The small "Explore the code" panels and the quiz at the end were a good second layer: I could ignore them while I was focused on the steps and go back to them once the payment had settled. This was my first time taking a Fiber tutorial end to end, so I cannot compare it to the older split format from experience, but I can say the inline version removed the main thing that usually makes me lose the thread in a walkthrough — switching between instructions and the app. If the older format puts the demo at the top and all the explanation underneath, I would expect it to work for someone skimming, but I would personally keep choosing the version where the reasoning sits next to the action.

## Optional question 1: what surprised me

**What surprised you or stood out about paying to unlock the report?**

Two things. First, the rejection before payment was immediate and unambiguous: pressing "Decrypt without key" produced an AES-GCM failure rather than a vague "content locked" message, which made it obvious that the ciphertext I was holding was genuinely useless without Seller C's key. Second, I had assumed the payment was only proof that money moved. What actually happens is that the key itself is the invoice preimage, so paying is what hands the key over — the invoice payment hash is just a commitment to a secret the seller is still holding. Seeing the preimage appear after settlement and then decrypt the same bytes I had already failed to open made the design click.

## Optional question 2: where I was unsure

**Was there a step where you were unsure what to do next or why it mattered?**

Waiting for `CHANNEL_READY` was the part I was least sure about. The funding appeared in my wallet quickly, so it was tempting to assume the channel was usable while the opening states were still moving through `AWAITING_TX_SIGNATURES`. The other place was the last-hop hint in the offer: I did not immediately understand why the buyer needs Bottle's channel outpoint, fee rate, and expiry delta. Reading the surrounding explanation made it clear that the buyer is routing through Bottle and needs to name the final channel explicitly rather than discovering it.

## Optional question 3: what I would build

**What would you like to build using this pay-to-unlock flow?**

I built LockerPay, the Advanced entry in this repository: an operator seals a smart-locker pickup manifest — code, parcel, recipient, note — with AES-256-GCM and sells it behind a 1 CKB Fiber invoice. The customer sees the locker listing and the ciphertext, cannot open it before paying, and after settlement uses the revealed preimage to decrypt the manifest, verify its SHA-256 digest, and enter the four-digit code on the keypad to open the door. Beyond that demo I would like to use the same pattern for paid API responses or one-off data exports, where the response body is encrypted with the key that becomes the invoice preimage.

## Optional question 4: one change to the tutorial

**If you could change one thing about the tutorial, what would it be?**

I would add a short, explicit note near the channel cards that the on-chain funding balance and the channel's spendable balance are different numbers, and that the channel only becomes usable at `CHANNEL_READY`. That is the one point where I had to reason about the state machine myself instead of being told what to expect.
