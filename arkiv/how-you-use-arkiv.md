# How we use Arkiv

**What we filter on.** Two indexed attributes. `player` is the only key a returning player brings to a new edition: the same login gives the same smart account address at every event. `edition` enforces one badge per player per event. Everything else is display data and stays unindexed, which is cheaper.

**Who can edit each entity.**

- Badges are created `readonly`. A badge says "this player found a tag at this event". That fact should never change, so nobody can change it after it is issued, our issuer included. The server only issues one after reading the claim from the edition's contract.
- The passport is owned by the issuer, and any edition's server patches it for a player who is signed in with their wallet. Players don't hold Arkiv gas, so the issuer pays for every write.
- Every read filters on `createdBy(issuer)`. Arkiv is public and anyone can write entities under our schema names, so a badge someone else wrote is ignored.

**When it expires.** Badges and passports get the maximum lifetime, about six months. Every new badge or photo change renews the passport. That matches how people play: a player who comes to an event every few months keeps their passport, and one who stops coming lets it lapse instead of us keeping their data indefinitely. Badges renew only with new activity.

**What each Arkiv feature changes for players.**

| Feature | What the player sees |
|---|---|
| Query by `player` | At a new edition, with a fresh database, their passport page already shows their photo and past badges |
| `edition` + one-badge rule | "New passport badge: Mumbai 2!" on the first find at an event, and not on later finds |
| `readonly` | Badges can't be edited, so they can be trusted as a record |
| Expiry, renewed on activity | Data of players who stop coming lapses by itself |
| Batches | The badge and the passport appear together, after one write |
| `photo` + `photoNonce` | The photo appears at every edition, and removing it makes it unreadable everywhere, because the landing checks the nonce on Arkiv before it hands out a key |

**Next step.** Hand each passport to the player's own wallet with `changeOwnership`, once players can write to Arkiv without holding gas.
