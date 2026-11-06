# Why Arkiv

**If this data stayed in our current database, what would players lose?** Their history. Each edition of Treasure Hunt is a separate deployment with its own Neon database, created a few days before the event and left idle after it. Devcon 8's database was created on 2 November 2026 and started with no players. A player who played at three of our events had three unrelated accounts, and none of them knew about the others. Joining the databases would mean every new edition holding credentials to every old one, and keeping every old database awake. On Arkiv, a new edition reads the passport with one query and no credentials. The landing site, which is not an edition, checks the same passport before it hands out a photo key.

**What did we keep off Arkiv, and why?**

| Kept off | Why |
|---|---|
| The photo itself | Too large for an entity, and personal. It is encrypted and stored on Swarm; Arkiv only holds the reference |
| The photo key | Arkiv is public. The key is derived on our landing site and never stored |
| Email, phone, contacts | Personal data, and Arkiv is public |
| NFC claim codes | They are the secret that proves a player was at a tag |
| Token balances and claims | Already on the game chain (Nova Cidade); a badge stores the claim transaction hash instead |
| The live leaderboard | It is per edition, changes every few seconds, and is rebuilt from chain events |
