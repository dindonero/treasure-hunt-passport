# Treasure Hunt Passport

Treasure Hunt turns physical events into on-chain scavenger hunts. Players tap NFC tags hidden around a venue, claim ERC-20 rewards gaslessly through ERC-4337 smart accounts, climb a live leaderboard and redeem tokens for merch. It has run at real events since 2025 (Cadaval, Smart Cities Summit, Data Summit, FIL, Lisbon Games Week, NEI, Devcon 8 and others), one deployment per event at `<event>.treasurehunt.pt`.

Each edition is its own deployment with its own database. Until now, nothing a player did at one event reached the next one. This repository adds a **player passport** that every edition can read: a badge for each edition the player has played, and a profile photo that follows them. The passport lives on **Arkiv**. The photo is encrypted and stored on **Swarm**.

Live demo, two editions with separate databases and separate contracts:

- https://mumbai1.treasurehunt.pt
- https://mumbai2.treasurehunt.pt

## ETHGlobal Mumbai 2026, continuity track

### What existed before the event

- Commit `46673c5`, tagged `pre-hackathon`, dated 23 July 2026: the production app as it stood then. Next.js frontend and API, Foundry contracts (`TreasureHuntRewards` ERC-20 with signature-gated claims, `Account`/`AccountFactory` for ERC-4337), and one real event's public report data. Its README describes plans for an earlier hackathon; that text is part of the snapshot.
- Commit `6ca48cb`: the Supabase-to-Neon database layer (`lib/db.ts` and the clients in `lib/supabase/`), written on 24 July 2026 for our production deployments and carried over unchanged. It is existing code, not hackathon work. It is here so each edition can get its own database from Vercel.

### What was built at ETHGlobal Mumbai

Everything after `6ca48cb`.

| Piece | Files |
|---|---|
| Passport and badge records on Arkiv | `lib/arkiv.ts` |
| Badge issued on the first verified find in an edition | `app/api/passport/badge/route.ts`, hook in `app/tag/[claimCode]/page.tsx` |
| Passport read API | `app/api/passport/route.ts` |
| Encrypted photo: AES-256-GCM, ciphertext on Swarm | `lib/photo.ts`, `app/api/passport/photo/route.ts` |
| Key service on the landing site (copy of the deployed file) | `landing/photo-key-route.ts`, live at `https://www.treasurehunt.pt/api/photo-key` |
| Passport page | `app/passport/` |
| Check script | `scripts/test-passport.mjs` |
| Arkiv judging notes | `arkiv/` |

### How it works

1. A player taps a tag and claims it. The claim is an on-chain transaction from the player's smart account, as before.
2. The tag page then calls `POST /api/passport/badge`. The server checks the claim on the contract (`claimedRewards`). If this is the player's first find in this edition, it writes the edition's badge to Arkiv, plus the passport if this is their first find anywhere, in one Arkiv transaction.
3. `/passport` reads the passport and every badge back from Arkiv. Another edition, with its own database, shows the same passport and adds its own badge.
4. A profile photo is encrypted on the server and the ciphertext goes to Swarm. The passport holds the Swarm reference and a random nonce. The key comes from `treasurehunt.pt/api/photo-key`, which derives it from a master secret and the nonce, and only answers for the nonce currently on the passport. Removing the photo clears the nonce, so the copy on Swarm can no longer be decrypted by anyone, our servers included.

Details: `arkiv/schema.md`, `arkiv/how-you-use-arkiv.md`, `arkiv/swarm.md`.

### Run one query

Every badge and passport is written by the issuer wallet `0x2e246E61039Eb470aBFf1E20E71D414756Af5a0e` on Arkiv's Rabdi testnet (chain ID 7794095). All badges we have issued:

```bash
curl -s https://rpc.rabdi.db-chain.testnet.arkiv.network -H 'content-type: application/json' --data '{
  "jsonrpc": "2.0", "id": 1, "method": "arkiv_query",
  "params": ["arkiv.schema = str('"'"'treasurehunt.badge'"'"') AND $creator = addr(0x2e246E61039Eb470aBFf1E20E71D414756Af5a0e)",
             {"select": {"key": true, "attributes": true, "expiresAt": true}}]
}'
```

## Running locally

```bash
pnpm install
cp .env.example .env.local   # fill in values, see comments in the file
pnpm dev                     # localhost:3000
```

The database schema is one idempotent file, `supabase-schema.sql` (the name is historical; it runs on Neon). Contracts: `cd contracts && forge build && forge test`.

Check for the passport (offline crypto checks, then a round trip on Arkiv's testnet with a throwaway player that it deletes afterwards):

```bash
node --env-file=.env.local scripts/test-passport.mjs
```

## Use of AI

The hackathon work was written with Claude Code (Anthropic), directed by the team: the Arkiv and Swarm integration, the API routes, the passport page, the check script, the deployment and DNS setup, and first drafts of the files in `arkiv/`, which the team then edited. The team chose the design: a badge per edition, and an encrypted photo whose key is served by the landing site.

## License

MIT, see [LICENSE](LICENSE).
