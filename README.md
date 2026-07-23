# Treasure Hunt

Treasure Hunt turns physical events into on-chain scavenger hunts. Players tap NFC tags hidden around a venue, claim ERC-20 rewards gaslessly through ERC-4337 smart accounts, climb a live leaderboard, and redeem tokens for merch. The app has run in production at real events (Festival da Juventude Cadaval, Smart Cities Summit, Data Summit and others), one deployment per event at `<event>.treasurehunt.pt`.

## ETHGlobal Lisbon 2026, Continuity Track

This repository is our continuity-track submission base.

**Prior state disclosure.** The initial commit (tagged `pre-hackathon`, dated before the event) is the pre-existing production app: Next.js 16 frontend and backend, Foundry contracts (`TreasureHuntRewards` ERC-20 with signature-gated claims, `Account`/`AccountFactory` for ERC-4337), Supabase schema, and one real event's public report data. This code was written over the preceding months and is disclosed as pre-existing work.

**Built during the hackathon.** Everything after the `pre-hackathon` tag. Planned integrations:

- **World** (Selfie Check, Identity Check): proof-of-human gating on merch redemption and a verified leaderboard tier, one redemption per unique human via the action-scoped nullifier; document-backed age attestation for prize pickup on kids' editions. Plus the beta testing documentation both tracks require.
- **ENS**: a self-hosted CCIP-Read (ENSIP-10 + EIP-3668) wildcard resolver so every player gets `<name>.treasurehunt.eth` resolving to their smart account, with game state served as text records and edition configuration read from ENS at boot.
- **Sui / Walrus**: event media and post-event archives stored on Walrus, player completion certificates as content-addressed blobs, anchored on-chain.

This section will be updated during the event with what actually shipped, with pointers to the relevant commits and files.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind v4. Thirdweb v5 smart accounts (ERC-4337, sponsored gas) on the Nova Cidade chain. Foundry contracts. Supabase (Postgres + storage). Vercel hosting.

## Running locally

```bash
pnpm install
cp .env.example .env   # fill in values, see comments in the file
pnpm dev               # localhost:3000
```

Contracts:

```bash
cd contracts
forge build
forge test
```

The database schema is a single idempotent file, `supabase-schema.sql`; paste it into the Supabase SQL editor to bring up a new project.
