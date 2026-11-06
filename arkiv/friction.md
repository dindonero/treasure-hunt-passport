# Friction

TODO (team): add what you hit while testing.

1. **A server wallet can't be set up without a human.** The Hub signs in with a browser wallet only, and both "Generate access key" and the faucet sit behind a captcha. Our issuer is a server key. In the end we signed in with another wallet we control, ticked the captcha by hand, and moved the test GLM from that wallet to the issuer with a plain transfer. A CLI or API path for server keys (sign a message, get a key and a faucet drip) would remove that.
2. **Six months is the longest lifetime.** A passport should outlive a year of events. We renew it on every badge, so a player who skips two events in a row loses it. We would use a longer maximum, or a way for the player to keep it alive cheaply. `permissionlessExtension` helps, but someone still pays.
3. **No event when an entity expires.** We can't tell a player their passport is about to lapse without polling `$expiresAt` ourselves.
4. **The access key has to live in every service that reads.** Two editions and the landing all query Arkiv, so the same key sits in three projects. Locking a key to an origin only helps browsers. A read-only key type for servers would be safer to spread around.

What worked well: the SDK's typed schemas caught mistakes at compile time, `executeBatch` made "badge plus passport" one atomic write, and `query.toString()` gave us the exact query string to call the JSON-RPC directly from the landing without adding the SDK there.
