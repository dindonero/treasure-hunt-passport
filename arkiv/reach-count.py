import json, urllib.request, collections
EX = "https://testnet.explorer.novaims.unl.pt/api/v2"
ED = "ethglobal cobaia bootcamp patos culturalweek fil pscs cadaval datasummit summerbc lgw nei devcon".split()
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "th-reach"}), timeout=20) as r: return json.load(r)
holders = {}
seen = {}
for e in ED:
    try: c = get(f"https://{e}.treasurehunt.pt/api/config/active-contract")["address"]
    except Exception as x: print(e, "no active contract:", str(x)[:60]); continue
    addrs, params = set(), ""
    for _ in range(200):
        try: d = get(f"{EX}/tokens/{c}/holders{params}")
        except Exception as x: print(e, "holders unavailable:", str(x)[:40]); break
        addrs |= {i["address"]["hash"].lower() for i in d["items"]}
        np = d.get("next_page_params")
        if not np: break
        params = "?" + "&".join(f"{k}={v}" for k, v in np.items())
    if c.lower() in seen: print(e, "shares its contract with", seen[c.lower()]); continue
    seen[c.lower()] = e
    holders[e] = addrs
    print(f"{e:13} {c} holders={len(addrs)}")
count = collections.Counter(a for s in holders.values() for a in s)
print("unique players:", len(count), " played 2+ editions:", sum(1 for n in count.values() if n >= 2), " 3+:", sum(1 for n in count.values() if n >= 3))
