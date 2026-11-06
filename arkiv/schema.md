# Arkiv schema

Network: Rabdi testnet, chain ID 7794095. Every entity is created by the issuer wallet `0x2e246E61039Eb470aBFf1E20E71D414756Af5a0e`, one wallet for every edition of the game. Code: `lib/arkiv.ts`.

## `treasurehunt.passport`

One per player.

| Field | Type | Indexed | Holds |
|---|---|---|---|
| `player` | addr | yes | The player's smart account address (the address that claims tags) |
| `firstEdition` | str | no | Slug of the edition where the passport was created |
| `handle` | str, optional | no | The player's handle, if they set one |
| `photo` | str, optional | no | Swarm reference of the encrypted profile photo |
| `photoNonce` | str, optional | no | Nonce the landing uses to derive the photo key. Never the key itself |

- Created on the player's first verified find in any edition, or on their first photo upload.
- Owner and creator: the issuer. Any edition's server patches it for a signed-in player (photo, nonce).
- Expiry: the maximum lifetime (about 182.5 days), renewed every time the player earns a badge or changes their photo.

## `treasurehunt.badge`

One per player per edition.

| Field | Type | Indexed | Holds |
|---|---|---|---|
| `player` | addr | yes | The player's smart account address |
| `edition` | str | yes | Edition slug, e.g. `mumbai1` |
| `editionName` | str | no | Display name, e.g. `Mumbai 1` |
| `tagId` | str | no | On-chain id of the first tag found in that edition |
| `tagName` | str | no | Its name |
| `claimTx` | str | no | Hash of the claim transaction on the game chain (Nova Cidade) |
| `foundAt` | u64 | no | Unix time of the find |

- Created after the server has checked the claim on the edition's contract (`claimedRewards`).
- Created with the `readonly` flag: nobody, the issuer included, can change it afterwards.
- Expiry: the maximum lifetime, set at creation.

## Queries the app runs

| Where | Query |
|---|---|
| Passport page, photo routes, badge issuing | `treasurehunt.passport` where `player = X`, created by the issuer |
| Passport page | `treasurehunt.badge` where `player = X`, created by the issuer |
| Badge issuing (one per edition) | `treasurehunt.badge` where `player = X AND edition = Y`, created by the issuer |
| Landing key service, before handing out a key | `treasurehunt.passport` where `player = X`, created by the issuer, selecting only `photoNonce` |
