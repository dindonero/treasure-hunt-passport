# Swarm

**Before the event.** Treasure Hunt did not use Swarm. Uploaded images were stored as bytes in Postgres.

**What lives where.**

| Data | Where |
|---|---|
| The player's profile photo, encrypted with AES-256-GCM (`iv \| ciphertext \| tag`) | Swarm |
| The Swarm reference of that ciphertext | Arkiv, passport field `photo` |
| A random nonce | Arkiv, passport field `photoNonce` |
| The key, derived as HMAC(master secret, player:nonce) | Nowhere. Our landing site derives it on request |

We encrypt it ourselves instead of using Swarm's encrypted upload, because an encrypted Swarm reference carries its key and Arkiv entities are public. Our own encryption also makes the key revocable: once the nonce is cleared from the passport, the landing refuses it, so the copy on Swarm becomes unreadable even though it can't be deleted.

**One entity and its reference.** TODO (team): after the demo upload, paste the passport entity key and its Swarm reference here, with the read link `https://api.gateway.ethswarm.org/bytes/<reference>` (it returns ciphertext).

**Postage.** Uploads go through the public gateway `https://api.gateway.ethswarm.org`, which stamps them with its own batch, so we bought none. TODO (team): if the Swarm booth gives us a batch, set `SWARM_API_URL` to that Bee node and `SWARM_POSTAGE_BATCH_ID` to the batch, and record the batch ID and who gave it here.

**Files.** `lib/photo.ts` (`swarmUpload`, `swarmDownload`, encryption), `app/api/passport/photo/route.ts` (upload, read, remove).

**Try it.**

1. Sign in at https://mumbai1.treasurehunt.pt, open Passport, add a photo. You need a phone or browser and nothing else.
2. Read the passport from Arkiv (query in the README) and copy `photo`.
3. `curl https://api.gateway.ethswarm.org/bytes/<photo> -o blob.bin` returns the ciphertext. It does not open as an image.
4. Sign in at https://mumbai2.treasurehunt.pt with the same login: the Passport page shows the same photo.

**In the demo video.** TODO (team): timestamp of the photo upload and of the photo appearing at the second edition.

**What got in our way.** Getting our own batch means buying xBZZ on Gnosis Chain, which we could not do quickly at the venue. The public gateway removed that, but we can't see how long its stamps last, so we can't tell players how long the stored copy will exist.
