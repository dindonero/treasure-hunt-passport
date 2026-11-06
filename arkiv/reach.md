# Reach

**Who uses Treasure Hunt today.** Organisers who run it at their events, and the players at those events. Every player who earns a token holds that edition's ERC-20 on the game chain, so the holders are public. Counted on 6 November 2026 from the Nova Cidade explorer (`arkiv/reach-count.py`, run it to reproduce):

| Edition | Player accounts |
|---|---:|
| FIL / Smart Cities Summit | 238 |
| NEI 2026 | 164 |
| Data Summit | 47 |
| ETHGlobal Lisbon demo | 26 |
| Cobaia | 19 |
| Summer Bootcamp | 15 |
| Bootcamp | 5 |
| Devcon 8 | 1 |

That is **488 distinct player accounts**. Four more editions (Cadaval, Cultural Week, Patos, Lisbon Games Week) are not counted because the explorer does not index their tokens, so these are lower bounds. Devcon 8 was set up but barely played.

**Returning players.** Only 13 accounts appear in two or more editions, and 4 in three or more. Each edition starts from an empty database, so a returning player gets nothing for coming back; we can't tell how many came back under a new login. The passport is the first thing that rewards coming back.

**Will they use the part on Arkiv?** Every player who finds a tag gets a badge without doing anything, so everyone at a passport edition uses it. Returning players are the ones who notice: their photo and past badges are waiting at the next event.

**Will it ship after Mumbai?** Yes. New editions are forked from the current production line, and the passport is a few files plus three environment variables (`lib/arkiv.ts`, `lib/photo.ts`, the passport routes and page). The next step is backfilling badges for past editions from the claim events already on the game chain, so that past players have a passport from day one.
