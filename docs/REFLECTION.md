# Reflection

**How did it feel having the explanations alongside each step? Which format worked better?**

Better than the demo-on-top, walkthrough-below layout I've used elsewhere. The channel states are the confusing part, so having the text on the card I was already looking at meant I never lost the thread. The one thing I missed was seeing the whole flow at once — a collapsed summary at the end would help.

**What surprised you about paying to unlock the report?**

I assumed payment would be a gate on my side: pay, then something unlocks server-side. It's the opposite. The key is the preimage, so settlement is what hands it over, and there is no moment where the seller can hold it back. The rejection before paying is what made it land — the ciphertext genuinely didn't open, it wasn't just a locked label.

**If you ran into a problem, what happened and how did you resolve it?**

Two, both on a live node. The first channel open failed with a peer feature error before the handshake finished; nothing was submitted, and opening again a moment later worked. The one that cost me time was `Cannot convert undefined to a BigInt` when sealing a locker. The node returns `channel_outpoint` as packed bytes, but the SDK types describe `{ tx_hash, index }`, so I handled both shapes. That kind of gap is also why the last-hop hint needs explaining: the seller's channel isn't in the public graph, so the payer has to be told the final hop.
