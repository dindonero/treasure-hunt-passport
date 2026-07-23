# Contracts

## Build Artifact Sync

After any changes to `src/TreasureHuntRewards.sol`, you must regenerate the committed artifact used by the Next.js app:

```bash
cd contracts && forge build
node -e "
const a = require('./out/TreasureHuntRewards.sol/TreasureHuntRewards.json');
process.stdout.write(JSON.stringify({ abi: a.abi, bytecode: a.bytecode.object }, null, 2));
" > ../lib/contracts/TreasureHuntRewards.artifact.json
forge flatten src/TreasureHuntRewards.sol > ../lib/contracts/TreasureHuntRewards.flattened.sol
```

The app imports ABI + bytecode from `lib/contracts/TreasureHuntRewards.artifact.json` (not from `contracts/out/`, which is gitignored). The flattened source at `lib/contracts/TreasureHuntRewards.flattened.sol` is used for automatic Blockscout verification on deploy. If you skip these steps, Vercel builds will fail with a missing module error.
