// End-to-end check against two deployed editions, with a fresh EOA as the player:
// on-chain claim, sign-in, badge, photo across editions, removal. Needs the game
// signer key (it funds the player with 0.01 ETH and signs the reward).
//   1. In edition 1's admin create a tag, set it hidden, note its claim code and chain id
//   2. SIGNER_PRIVATE_KEY=0x... node scripts/e2e.mjs <claimCode> <chainId>
// E2E_CONTRACT, E2E_ED1, E2E_ED2 override the mumbai1/mumbai2 defaults.
// Leaves the player's passport and badge on Arkiv (delete them with the issuer if unwanted).
import { createRequire } from "node:module"
import { randomBytes } from "node:crypto"
import assert from "node:assert/strict"
const require = createRequire("/Users/dinis/Desktop/threpos/treasure-hunt-passport/package.json")
const { ethers } = require("ethers")

const [claimCode, chainId] = process.argv.slice(2)
const RPC = "https://testnet.novaims.unl.pt/"
const CONTRACT = process.env.E2E_CONTRACT || "0x745F941759A223a3Ec6DBd4e96291A2633127415" // mumbai1
const ED1 = process.env.E2E_ED1 || "https://mumbai1.treasurehunt.pt", ED2 = process.env.E2E_ED2 || "https://mumbai2.treasurehunt.pt"
const hx = k => (k.startsWith("0x") ? k : "0x" + k)
const provider = new ethers.JsonRpcProvider(RPC)
const signer = new ethers.Wallet(hx(process.env.SIGNER_PRIVATE_KEY || ""), provider)
const player = ethers.Wallet.createRandom().connect(provider)
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

// 1. fund the player and claim the tag on-chain with a signer-issued signature
log("player", player.address)
await (await signer.sendTransaction({ to: player.address, value: ethers.parseEther("0.01"), gasLimit: 2_000_000 })).wait()
const amount = ethers.parseEther("10")
const encoded = ethers.AbiCoder.defaultAbiCoder().encode(["address", "address", "string", "string", "uint256"], [CONTRACT, player.address, "object", chainId, amount])
const sig = signer.signMessageSync(ethers.getBytes(ethers.keccak256(encoded)))
const contract = new ethers.Contract(CONTRACT, ["function claimObjectReward(string,uint256,bytes)", "function balanceOf(address) view returns (uint256)"], player)
const claim = await (await contract.claimObjectReward(chainId, amount, sig, { gasLimit: 2_000_000 })).wait()
assert.equal(claim.status, 1)
log("claimed on-chain", claim.hash, "balance", ethers.formatEther(await contract.balanceOf(player.address)))

// 2. sign in to an edition as the player, like the app does
async function login(base) {
  const messageToSign = `I am signing in to Treasure Hunt\nWallet: ${player.address}\nTimestamp: ${Date.now()}`
  const signature = await player.signMessage(messageToSign)
  const res = await fetch(base + "/api/auth/authenticate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: player.address, signature, messageToSign }) })
  assert.equal(res.status, 200, "login " + base + " " + (await res.text()))
  const cookie = res.headers.getSetCookie().map(c => c.split(";")[0]).join("; ")
  return (path, init = {}) => fetch(base + path, { ...init, headers: { ...(init.headers || {}), cookie } })
}
const ed1 = await login(ED1)
let r = await ed1("/api/passport"); let j = await r.json()
assert.equal(r.status, 200); assert.equal(j.passport, null); assert.equal(j.badges.length, 0)
log("mumbai1 passport before: none")

// 3. badge
r = await ed1("/api/passport/badge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ claimCode, claimTx: claim.hash }) })
j = await r.json(); assert.equal(r.status, 200, JSON.stringify(j)); assert.equal(j.created, true); assert.equal(j.badge.edition, "mumbai1")
log("badge issued", j.badge.key)
r = await ed1("/api/passport/badge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ claimCode, claimTx: claim.hash }) })
j = await r.json(); assert.equal(j.created, false)
log("second call: no duplicate badge")
r = await ed1("/api/passport/badge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ claimCode: "00000000-0000-0000-0000-000000000000" }) })
assert.equal(r.status, 404); log("unknown tag: 404")

// 4. photo: upload at mumbai1, read back, read at mumbai2, delete at mumbai2, gone at mumbai1
const photo = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(3000)])
const fd = new FormData(); fd.append("file", new Blob([photo], { type: "image/jpeg" }), "p.jpg")
r = await ed1("/api/passport/photo", { method: "POST", body: fd }); j = await r.json()
assert.equal(r.status, 200, JSON.stringify(j)); const nonce = j.photoNonce; log("photo uploaded, nonce", nonce)
r = await ed1("/api/passport/photo"); assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "image/jpeg")
assert.deepEqual(Buffer.from(await r.arrayBuffer()), photo); log("mumbai1 photo decrypts to the original")

const ed2 = await login(ED2)
r = await ed2("/api/passport"); j = await r.json()
assert.equal(j.passport.photoNonce, nonce); assert.deepEqual(j.badges.map(b => b.edition), ["mumbai1"])
log("mumbai2 sees the passport: badge from mumbai1 + photo nonce, with its own empty database")
r = await ed2("/api/passport/photo"); assert.equal(r.status, 200); assert.deepEqual(Buffer.from(await r.arrayBuffer()), photo)
log("mumbai2 photo decrypts to the original")
r = await ed2("/api/passport/photo", { method: "DELETE" }); assert.equal(r.status, 200)
r = await ed1("/api/passport/photo"); assert.equal(r.status, 404)
r = await ed1("/api/passport"); j = await r.json(); assert.equal(j.passport.photoNonce, null)
log("deleted at mumbai2: gone at mumbai1 too")
console.log("E2E OK player=" + player.address.toLowerCase())
