# Treasure Hunt Passport (ETHGlobal Mumbai 2026, continuity track)

Individual-player NFC treasure hunt plus a **player passport on Arkiv**: one
passport per player and one readonly badge per (player, edition), so a player's
history and encrypted profile photo follow them between editions that each have
their own database. Built at ETHGlobal Mumbai (5 to 7 Nov 2026). Submission
deadline Sat 7 Nov 09:00 IST.

Base: the Lisbon repo's baseline commit `46673c5` only (tag `pre-hackathon`),
none of the Lisbon World/ENS/Sui commits (deliberately not exposed), plus the
Neon layer `6ca48cb` (existing code). The rest of this file below "Project
structure" is the Cadaval-era guide and still describes the app; where it says
Supabase, read Neon through the supabase-js shim in `lib/db.ts`.

Hackathon hygiene: never squash, commit in small steps, keep README's
"What existed before / What was built" current, AI use disclosed in README.
Repo must be public at submission (MIT, `LICENSE`).

## Passport (the hackathon work)

| File | Role |
|---|---|
| `lib/arkiv.ts` | Schemas `treasurehunt.passport` / `treasurehunt.badge`, reads (always `createdBy(issuer)`), `issueBadge` (one batch tx), `setPhoto`, `clearPhoto`. No `@/` imports, so the check script can load it |
| `lib/photo.ts` | AES-256-GCM, landing key client (`sha256=` HMAC in `x-th-relay-signature`, body has `ts`), Swarm upload/download (default: public gateway `api.gateway.ethswarm.org`, no batch needed) |
| `app/api/passport/*` | `GET` passport+badges; `badge` POST (checks `claimedRewards` on-chain first); `photo` GET/POST/DELETE (owner only) |
| `app/passport/` | The page; bottom nav slot replaced Home |
| `landing/photo-key-route.ts` | Copy of `treasure-hunt-landing/app/api/photo-key/route.ts` (deployed there). Excluded from tsconfig |
| `scripts/test-passport.mjs` | `node --env-file=.env.arkiv-issuer scripts/test-passport.mjs`: offline crypto asserts, then a testnet round trip that cleans up after itself. `/scripts/*` is ignored except this file |
| `arkiv/*.md` | Arkiv judging files (drafts with team TODOs) |

Photo keys: the landing derives `HMAC(PHOTO_MASTER_KEY, player:nonce)` and for
`read` only answers if the nonce equals the passport's current `photoNonce` on
Arkiv. `PHOTO_MASTER_KEY` exists only as a Sensitive env var on the landing
project; losing it makes every stored photo unreadable.

## Deployment (two demo editions)

| | mumbai1 | mumbai2 |
|---|---|---|
| URL | https://mumbai1.treasurehunt.pt | https://mumbai2.treasurehunt.pt |
| Vercel project (nova-blockchain-lab) | `treasure-hunt-mumbai1` `prj_vSmIjQfPj0sCXEEDz3H4v68FT9Ww` | `treasure-hunt-mumbai2` `prj_tjqkUPm5yCKkv7a5L1F9MCGu0DaT` |
| Neon (Vercel integration, fra1) | `treasure-hunt-mumbai1-db` | `treasure-hunt-mumbai2-db` |
| Contract (Nova Cidade) | `0x745F941759A223a3Ec6DBd4e96291A2633127415` block 134222 | `0x3111bDbF59E49dcF8Ff819fbe4C00cf5D0052842` block 134223 |

- Deploy without Git integration: `VERCEL_ORG_ID=team_CQz61ggf0OqA8z9hRzruzspm VERCEL_PROJECT_ID=<id> vercel deploy --prod --yes`
  from the repo root. `vercel.json` must keep `"framework": "nextjs"` (CLI-created
  projects have no preset and otherwise serve 404 everywhere).
- `.vercelignore` keeps `.env*` and `/contracts` out of uploads (`/contracts` with
  the slash, or `lib/contracts` is dropped too).
- DNS: A records `mumbai1`/`mumbai2` → `76.76.21.21` in Cloudflare (DNS only).
  API token in `~/Desktop/threpos/.cloudflare.env`.
- Paymaster: both `/api/config/active-contract` URLs are in `TREASURE_HUNT_URLS`
  on urbanlab (backup `paymaster-proxy.js.bak-2026-11-06-mumbai`).
- DBs were bootstrapped with the schema, the 17 admin wallets copied from Devcon,
  and the active `contract_deployments` row.
- Arkiv issuer: `0x2e246E61039Eb470aBFf1E20E71D414756Af5a0e`, funded with tGLM
  moved from `0x7502…1081` (the game signer, which the user signed in to the Hub
  with). Issuer key and access key (`ark_live_…`, project "treasure-hunt-passport",
  Hub account `0x7502…1081`) are in `.env.arkiv-issuer` (gitignored) and on both
  editions + the landing as Sensitive vars. Hub login is wallet-only; generating a
  key or using the faucet needs the user to tick the captcha themselves. A full
  check-script run costs about 0.0015 tGLM.

## Project structure

```
app/
  admin/                Admin dashboard (NFC tags, social, merch, admins, contracts, reports, health)
  api/
    admin/              Admin CRUD (admins, contracts, health, merch, nfc-tags, reports, social-accounts)
    auth/               Wallet auth (authenticate, status, set-username, owns-any-tag, buy-merch)
    cron/               Leaderboard sync (Vercel cron)
    leaderboard/        Individual-aggregate leaderboard (mvp / tokens / found / social)
    merch/              Public merch list
    merch-history/      MerchPurchased events from Blockscout
    most-found-tags/    Most-found tag stats
    tag-heatmap/        In-play tags with coords + find_count
    nfc-tags/           dashboard, find, by-code, update
    reports/            Player-submitted tag issue reports (POST only)
    social-rewards/     Social rewards claims
    report/             Static snapshot serve (`/api/report/snapshot`)
    upload/             Authenticated image upload to Supabase storage
    user-objects/       Authed user's owned tags
    user-tag-status/    Authed user's tag claim status
  dashboard/            Treasure map + tag list
  leaderboard/, merch/, merch-history/, most-found/, social-rewards/
  report/               Post-event public report page (static, /report)
  scan/                 NFC-only scan entry (no QR fallback in Cadaval edition)
  tag/[claimCode]/      Tag detail / claim / find page
data/cadaval2026/       report-snapshot.json — built by scripts/build-report-snapshot.py
components/             Shared UI (no boost overlays in this edition)
contracts/              Foundry project — TreasureHuntRewards ERC-20
hooks/                  React hooks
lib/
  contracts/            Active-contract resolver, flattened source, ABI, deploy helpers
  supabase/             Server & admin clients
  *.ts                  signature, onchain, client-onchain, auth, thirdweb, wallet-context, game-status, datetime, merch-claims, reports, image-compress, social-links
public/                 Static assets (includes cadaval-logo.png, cadaval-festival-logo.webp)
scripts/                bootstrap-supabase.sh, load-test.mjs, build-report-snapshot.py, push-env-to-vercel.sh
supabase-schema.sql     Single consolidated schema (no migrations/ folder)
proxy.ts                Next.js middleware (admin JWT gate)
vercel.json             Cron schedule
```

## Package manager — pnpm only

Vercel installs from `pnpm-lock.yaml` with `--frozen-lockfile`. Any change to
`package.json` must be paired with a regenerated `pnpm-lock.yaml`.

- `pnpm add` / `pnpm remove` — never `npm install` or `yarn add`.
- Delete any stray `package-lock.json` / `yarn.lock`.
- After manual `package.json` edits: `pnpm install --lockfile-only` and commit.

## Tech stack

- Next.js 16 App Router, React 19, TypeScript
- Thirdweb v5 smart accounts + Nova Cidade chain
- ethers v6 for on-chain reads/writes
- Supabase (Postgres + storage + RLS disabled — JWT-gated in routes)
- Foundry contracts (TreasureHuntRewards, Account, AccountFactory)
- Blockscout for explorer API and verification
- Tailwind v4 + pruned shadcn/ui surface (`components/ui/`)
- Vercel hosting; 5-minute leaderboard cron (`*/5 * * * *`)

## Key commands

```bash
pnpm dev                    # localhost:3000
pnpm build && pnpm start
pnpm lint

# Contract build + sync artifact (after editing contracts/src/*.sol)
cd contracts && forge build
node -e "const a=require('./out/TreasureHuntRewards.sol/TreasureHuntRewards.json');process.stdout.write(JSON.stringify({abi:a.abi,bytecode:a.bytecode.object},null,2))" > ../lib/contracts/TreasureHuntRewards.artifact.json
forge flatten src/TreasureHuntRewards.sol > ../lib/contracts/TreasureHuntRewards.flattened.sol

# Deploy via admin UI (preferred) OR CLI:
DEPLOYER_PRIVATE_KEY=0x... SIGNER_ADDRESS=0x... \
  forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://testnet.novaims.unl.pt/ \
  --broadcast --gas-estimate-multiplier 100000 -vvv
```

## Environment variables

- Chain/contract: `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_CHAIN_NAME`, `NEXT_PUBLIC_EXPLORER_URL`
- Secrets: `SIGNER_PRIVATE_KEY`, `BACKEND_PRIVATE_KEY`, `JWT_SECRET`, `CRON_SECRET`
- Thirdweb: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `THIRDWEB_SECRET_KEY`, `NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS`, `NEXT_PUBLIC_ENTRYPOINT_ADDRESS`, `NEXT_PUBLIC_BUNDLER_URL`
- Supabase (per-environment): `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Optional: `VERCEL_TOKEN` (enables last-production-deploy state in Health tab)

### Favicon

The browser icon is the icon-only Treasure Hunt maze (no text), shipped as
both `public/favicon.png` (96x96 source) and `public/favicon.ico`
(multi-size 16/32/48, generated from the png via `sips` + a Python ICO
packer — see global CLAUDE.md). Declared in `app/layout.tsx`
`metadata.icons` (ico + png for `icon`, ico for `shortcut`,
`treasure-hunt-only-logo.png` for `apple`). Regenerate the `.ico` from the
`.png` if the icon ever changes.

### Venue map asset

`public/fil_map.jpeg` is the venue background image — the Cadaval Festival
da Juventude floor plan cropped to just the map (no title bar, no legend).
The legend is a separate asset `public/fil_map_legend.png`, rendered below
the selected-tag card on the dashboard (`app/dashboard/page.tsx`). The
aspect ratio is declared as `1278 / 863` in `venue-map.tsx`,
`tag-heatmap.tsx`, `report-sheet.tsx`, and the admin reports tab — update
all four if the map dimensions change. Both files are pre-cached by
`public/sw.js`. Tag pin coords are stored as percent-of-image (so
re-cropping the map will shift every existing pin).

## Feature scope — Cadaval edition

This edition is intentionally narrower than upstream:

- **NFC tags only** for player rewards. The scan page is NFC-only (no QR
  fallback — `react-zxing` and `@zxing/library` have been removed).
- **No QR codes / no stages.** Removed routes: `/claim/[urlId]`,
  `/stage/[urlId]`, `app/api/qr/*`, `app/api/admin/qr-codes`,
  `app/api/admin/qr-stages`. The `qr_codes` / `qr_stages` tables are not
  created.
- **No polls.** Removed routes: `/polls`, `app/api/polls/*`,
  `app/api/admin/polls/*`. The `polls` / `poll_options` tables are not
  created.
- **No reward boosts.** Removed: `app/api/boosts`, `app/api/admin/boosts`,
  `lib/boosts.ts`, `hooks/use-boosts.ts`, `components/boost-overlays.tsx`.
  Find-flow rewards are flat (`nfc_tags.token_reward`) — no multipliers.
- **Leaderboard categories** are now `mvp / tokens / found / social` only.
  The cron in `app/api/cron/sync-leaderboard/route.ts` syncs those four.

The deployed `TreasureHuntRewards` contract still exposes
`claimQRReward` / `claimPollReward` for ABI stability — they are simply
unused by this frontend.

## Working with the operator

- **No silent fallbacks for operator actions.** If something only works once
  the operator deploys / activates / configures something (contract, env var),
  surface it explicitly and stop — don't paper over with try/catch, mocked
  data, or defaults that hide the missing prerequisite.

## Scale

- **Public APIs edge-cached 10s** (`Cache-Control: public, s-maxage=10, stale-while-revalidate=30`): `/api/leaderboard`, `/api/most-found-tags`, `/api/tag-heatmap`, `/api/merch`. Auth-gated routes stay `no-store`.
- **Polling cadences:** leaderboard 10s, most-found 30s, tag-heatmap 30s, dashboard 120s, home 120s, admin health 30s. Don't tighten without matching cache headers.
- **Static asset SW** at `public/sw.js` (registered prod-only by `components/sw-register.tsx`). Caches `/_next/static/*` cache-first; small named-image allowlist stale-while-revalidate. **Never** caches HTML or `/api/*`.
- **Leaderboard cron** (`app/api/cron/sync-leaderboard/route.ts`) is delta-sync with confirmation/lookback for `found` and `social`:
  1. Read from `max(deployBlock, last_block - 50)` — lookback re-fetches recent logs every run.
  2. Idempotently upsert every parsed log into `chain_events` (UNIQUE `(contract_address, tx_hash, log_index)`).
  3. Recompute leaderboard for the category by paginated `SELECT` from `chain_events` and aggregating in Node — **aggregate-from-truth, never increment**.
  4. Watermark = `chain_head - 12` confirmation blocks.
  5. Backfill `nfc_tag_finds` only from rows ingested this run (UNIQUE `(tag_id, finder_address)`); set `nfc_tags.find_count = COUNT(*)`, never `+=`.
  Requires `chain_events` table (defined in `supabase-schema.sql`); cron throws if missing. `mvp` (transfers) and `tokens` (holders) still full-recompute from Blockscout.

## Database — single schema file

`supabase-schema.sql` is the **only** SQL artifact in this repo. There is no
`migrations/` folder. To bring up a new project, paste the file into the
Supabase SQL editor and run it. It is idempotent (`CREATE TABLE IF NOT EXISTS`
everywhere) so re-running on an existing DB is safe.

Tables created: `treasure_hunt_users`, `admin_wallets`, `nfc_tags`,
`nfc_tag_finds`, `merch`, `social_accounts`, `sync_state`,
`leaderboard_cache`, `contract_deployments`, `chain_events`, `tag_reports`,
plus the `switch_active_contract(target_id)` function and the `images`
storage bucket. RLS is disabled on every table — the Next.js route handlers
are the only callers and they enforce auth via JWT cookies.

## Conventions

- **Remove dead code on sight.** Zero in-code references → delete. Printed
  NFC tags route through `/tag/[claimCode]` — that's the only externally
  printed URL in this edition.
- **No vaul drawers for forms with text inputs on mobile.** Vaul's
  `repositionInputs={true}` + the drawer's `mt-24 max-h-[80vh]` push inputs
  off-screen on small iPhones when the soft keyboard opens. Use a centered
  `Dialog` positioned high (`top-[12%] translate-y-0` on mobile, centered on
  `sm:`). `UsernamePromptModal` is the reference.
- **Browser auto-translate is disabled globally** (`<html translate="no">` +
  `notranslate` meta in `app/layout.tsx`). iOS Safari/Chrome auto-translate
  replaces DOM text nodes in place; any subsequent React re-render then
  throws `NotFoundError` / `removeChild` and the global ErrorBoundary fires.
  Ship locale-specific copy via Next.js i18n rather than re-enabling.

### Wallet / auth

- **`WalletContext.address` is JWT-first.** `lib/wallet-context.tsx`:
  - `address = authAddress (JWT) || thirdwebAddress` — populated immediately on return visits.
  - `isWalletReady = !!thirdwebAccount` — sign-time gate. Anything calling `getSigner()` or submitting a userOp must check this. Tag page render gates Find/Claim on `isWalletReady` ("Preparing wallet…" state). Social-rewards gate at the click handler.
  - `isConnected` is an alias for `isWalletReady`.
  - Address-divergence detector compares `authAddress` against `thirdwebAddress` directly (triggers on wallet switch after JWT issued).
- **`ThirdwebProvider` is lazy-loaded** via `components/lazy-thirdweb-provider.tsx` (`next/dynamic({ ssr: false })`). While loading, Provider is a pass-through; `WalletContext` falls back to JWT address.

### Username is decoupled from sign-up

Picking a handle is **not** part of auth/claim. A first-time NFC tap can connect,
auto-authenticate, and auto-claim without ever being interrupted by a username
prompt (this previously collided with the find/claim `TransactionModal`).

- The handle is **display-only**: find/claim never writes `treasure_hunt_users`;
  the leaderboard resolves names at render time with a short-address fallback
  (`lib/handle-resolver.ts`). A player can play forever unnamed.
- `needsUsername` (`isAuthenticated && !hasHandle && …`) no longer auto-opens any
  modal. It now drives three placements, all rendering the shared
  `components/username-form.tsx` (the single set-username atom):
  1. **Header nudge** — `AppHeader` shows a small pulsing "Set name" button that
     opens `UsernamePromptModal` (now a *controlled, dismissable* Dialog).
  2. **Tag page (optional)** — after a first claim, an inline card on
     `app/tag/[claimCode]/page.tsx` (gated `needsUsername && (alreadyFound ||
     isOwner || adminSkipped)`). Skippable.
  3. **Leaderboard (mandatory)** — `app/leaderboard/page.tsx` gates the board
     behind the form when `needsUsername`. Unauthenticated visitors still see it.
- Consequence: `treasure_hunt_users` count = **named** wallets, a subset of
  participants. The true participant count is the distinct on-chain claimer count
  (`playersUnique`) surfaced in the admin Health tab; the "Players" KPI now leads
  with that and shows named count as the sub-label.

### Contract / on-chain

- **Active contract address** comes from `contract_deployments` table via `lib/contracts/active-contract.ts`. Never hardcode `NEXT_PUBLIC_CONTRACT_ADDRESS`. Use `getActiveContract()` server-side, `useContractAddress()` client-side.
- **All reward/merch signatures include `address(this)`** to prevent cross-contract replay. Regenerate artifact + flattened source if the contract changes.
- **Reward replay-protection is amount-independent.** Signed `messageHash` binds `(contract, user, type, id, amount)`, but on-chain dedup mapping is `claimedRewards[keccak256(contract, user, type, id)]`. Merch keeps the legacy `usedDigests` mapping (nonce makes each digest unique).
- **Nova Cidade RPC + bundler are CORS-`*` from the browser.** The nginx reverse proxy at `https://testnet.novaims.unl.pt/` sets CORS headers for `/` (RPC) and `/bundler/`.

### Tag-tap hot path

JWT-first; on-chain claim status read directly from the browser.

- `GET /api/nfc-tags/by-code/[claimCode]` returns tag metadata only, edge-cached `s-maxage=30, stale-while-revalidate=300` + `export const revalidate = 30`.
- The page reads user address from the JWT cookie via `WalletContext.address` and fires `lib/client-onchain.ts#hasClaimedObjectReward` directly against the public RPC.
- `lib/client-onchain.ts` is the browser-safe sibling of `lib/onchain.ts` — same encoding, reads `NEXT_PUBLIC_RPC_URL`, no `getActiveContract()` import. Always pass the contract address explicitly via `useContractAddress()`.
- `GET /api/auth/owns-any-tag` (per-user, no-store) fires only on `status === "blank"` to avoid a per-user request on the common hidden-tag path.

### Admin Health tab

`app/admin/tabs/health-tab.tsx` ↔ `app/api/admin/health/route.ts`. Hero status,
KPI tiles (players, holders, 1h tag finds, reverted txs, backend ETH, gas,
latest block, tag alerts), diagnostic cards (RPC, Bundler, Active contract
with on-chain `signer()`/`owner()` cross-check, Database with Supabase
project ref, Tag health cohort-relative anomaly detection,
Explorer/Blockscout, Server wallets, Env vars, Deployment context via Vercel
REST API).

**Player count** is a plain `treasure_hunt_users` count. **Block freshness is
informational only** — Nova Cidade only mines on activity, 5-10 min idle is
normal and never counted toward "Issues detected".

### Image uploads

All client → `/api/upload` flows go through `uploadImage()` in
`lib/image-compress.ts`. Compresses to JPEG under ~900 KB, normalises HEIC/etc.
to JPEG, throws `UnsupportedImageError` when the browser can't decode.
Server cap is 1 MB and `image/{jpeg,png,webp,gif}` only.

### Merch store

`app/merch/page.tsx` ↔ `app/api/merch/route.ts`; admin
`app/admin/tabs/merch-tab.tsx` ↔ `app/admin/admin-merch-editor.tsx` ↔
`components/photo-upload-box.tsx`.

Two-column tabbed grid of portrait (3:4) product cards, SOLD OUT pill,
per-item stock dot, description below name.

**Claim count** is derived on-demand from on-chain `MerchPurchased` events
via `lib/merch-claims.ts` (30s in-memory cache). No `claimed` column, no DB
write on purchase — chain is truth. `/merch-history` subscribes via RPC and
refetches the Blockscout-enriched view ~4.5s after each event.

**Stock guard** on `/api/auth/buy-merch` refuses to sign once on-chain count
reaches `merch.stock`.

**Dashboard map landmark.** `VenueMap` accepts an optional `landmarks` array
(`MapLandmark[]`). Dashboard places one for the merch store. Edit
`MERCH_STORE_LANDMARK` in `app/dashboard/page.tsx` if the booth moves.

**PhotoUploadBox focal point** (`components/photo-upload-box.tsx`): single
focal string on `merch.focal` (0–100% on each axis); 3 live previews
(3:4 / 1:1 / 16:9). Tap/drag updates focal; FILL/FIT toggles `cover` ↔
`contain`. Reuse for any non-square crop of an uploaded photo.

### Tag reports

Players flag pins via Map selection card → `ReportSheet`
(`components/report-sheet.tsx`). The 6 issue types live in `lib/reports.ts`
(single source of truth — player flow, API validator, admin tab). Photo and
description surfaced on every type; required per `needs`. Photos go through
`uploadImage()`. Reporter shown as username (short-address fallback only for
legacy reports pre-username-gate).

Submissions: `POST /api/reports`. Admin: `app/admin/tabs/reports-tab.tsx` ↔
`GET/PATCH/DELETE /api/admin/reports[/id]`. Admin GET joins `nfc_tags` to
surface `originalPos` + `tagClaimCode`. `wrong_place` reports get a
side-by-side `RelocatePreview` mini-map (red dashed = on-map / green =
reporter pin) + one-click **Accept new location & resolve** + **Open tag ·
edit** deep link. Priority is an inline 3-button segmented control. No
reward for filing. **Delete** removes the photo from the Supabase `images`
bucket *before* deleting the row.

### Edit-own-tag

`components/edit-own-tag-sheet.tsx`, wired in `app/dashboard/page.tsx#CompactTagCard`.
When a player taps their own pin the Report button is swapped for an Edit
button (bottom sheet, `PUT /api/nfc-tags/update`). Editable: name, hint
(collapsible "Add a hint" affordance), status (Active=`hidden` /
Paused=`registered`). Reward is read-only. `/api/nfc-tags/dashboard` returns
all in-play tags PLUS the caller's own `registered` tags so paused-by-owner
tags are still reachable.

### Social rewards links

`/social-rewards` action buttons route through `lib/social-links.ts` —
`getPreferredSocialUrl()` for the `<a href>` and `openSocialLink()` on click.
The helper picks native app deep links on mobile (`twitter://user?screen_name=…`,
`twitter://post?message=…`, `instagram://user?username=…`) with a ~1.5s
visibility-based fallback to the https URL if the app didn't open. Desktop and
LinkedIn always use the https URL — LinkedIn handles its own Universal Links /
App Links, and the legacy `linkedin://profile/{numericId}` scheme would need
numeric IDs we don't have.

Admin form (`admin-form-modal.tsx`) asks only the minimum per platform:
**Instagram & Twitter (Follow)** → handle only, **LinkedIn** → Profile URL
only (path varies: `/in/` vs `/company/` vs `/school/`), **Twitter (Post)** →
tweet template only, **View Link** → URL + optional display name. Card titles
use `getSocialDisplayLabel()` which falls back to the LinkedIn URL slug when
no handle is set.

### Post-event report snapshot

`scripts/build-report-snapshot.py` aggregates the post-event report data into
`data/cadaval2026/report-snapshot.json` (consumed by `lib/report.ts#readSnapshot`).
Trim of the PSCS reference script — no stages/QR/polls/exhibitors/zones.
Replaces "exhibitors" with `tags[]` plus `topHiders[]` and `topFinders[]`.

Pulls:
- Supabase: `treasure_hunt_users`, `nfc_tags` (joined to events via `chain_id`),
  `merch` (`select=*` because some Cadaval projects pre-date the
  `category`/`stock` columns), `social_accounts`. `tag_reports` is optional
  (caught + treated as empty if the table doesn't exist).
- Blockscout v2 for all contract logs + token metadata.
- Nova Cidade RPC for block timestamps (cached at
  `data/cadaval2026/.block-ts-cache.json`).
- Per-tx fetch from Blockscout for paymaster classification — sponsored when
  `to.hash == EntryPoint` and `method == "handleOps"` or the decoded
  `method_id == 0x1fad948c`. Cached at `data/cadaval2026/.tx-cache.json`
  (~1300 txs takes ~1min cold, instant warm).

Per-tag find counts come from `unique (tag, user)` pairs in `ObjectClaimed`
logs (joined `objectId == nfc_tags.chain_id`) — chain is truth, NOT
`nfc_tags.find_count`. `eventDays` is **locked** to `['2026-05-22',
'2026-05-23']` (Festival da Juventude ran 22–23 May 2026); the chain shows
two stray finds on 21 May and 24 May that are operator pre/post-event smoke
taps and would skew per-day aggregates.

**Active deployment lives in the Vercel env, not in `.env`.** Both the local
`.env` and `.env.example` point at the older Cultural Week Supabase
(`eawnkmcluggkdgjmqyqn`) whose only active contract is the Cultural Week
deploy. The production Cadaval Supabase is `odfkfxhnlxowmvbtllwh` and its
active contract is `0xb20161322d75c7c84e35d6abc2a29263edc52f87` (Festival
do Cadaval Test / FCT). Both are pinned at the top of
`scripts/build-report-snapshot.py` — do not "fix" them back to whatever
`.env` says.

Per-SKU `tokensExchanged` sums each `MerchPurchased.price` (wei → whole
tokens) to handle mid-event price changes.

### Other gotchas

- **`nfc_tag_finds` is a denorm cache** of on-chain `ObjectFound`, populated
  only by the leaderboard cron. The find flow doesn't write to it. Two
  consumers: `nfc_tags.find_count` for the dashboard map, and admin health.
  Eventually consistent.
- **`treasure_hunt_users.unicorn_handle`** is a legacy column name that now
  stores plain usernames. Renaming would touch many paths for low value —
  column stays.
- **Tag status flow.** Owner save via
  `app/tag/[claimCode]/page.tsx#handleSave` also sends `status: "hidden"` so
  the tag goes straight to "ready to be found". Owners toggle Hide/Un-hide
  later via the Edit sheet.
