# FlightShield

**Parametric flight-delay insurance that settles itself — AI validators check the flight, the contract pays the claim.**

FlightShield is parametric cover with no claims adjuster. A traveller buys a policy for a flight and a delay threshold; when they file a claim, GenLayer validators look up the flight's real status, agree on the actual delay, and the contract pays out automatically if the delay clears the threshold — no paperwork, no insurer deciding whether to honour it.

- **Contract (Bradbury, chain 4221):** `0xEC47ea313A5F00f403d90b009655E28e514e8BF0`
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0xEC47ea313A5F00f403d90b009655E28e514e8BF0
- **Live app:** https://flightshield.pages.dev

## What it does

The lifecycle is **buy → file → verify → settle**:

1. **`buy_policy(flight_number, departure_date, delay_threshold_minutes)`** — a traveller mints a policy. The threshold is clamped to `30–480` minutes. Stored as JSON in `policies: TreeMap[str, str]`, keyed by an incrementing `policy_count`, status `"active"`.
2. **`file_claim(policy_key)`** — only the policy holder can file, and only while active. The contract calls the internal `_check_flight` and compares the result to the policy threshold: if `delay_minutes >= threshold_min` the status becomes `"claimed"` (`claims_paid += 1`), otherwise `"denied"` (`claims_denied += 1`).
3. **Verification (the core).** Inside `_check_flight`, a `leader_fn` crawls evidence with **`gl.nondet.web.render(flightstats_url, mode="text", wait_after_loaded="3s")`** — a FlightStats tracker URL built from the flight number and date. The fetched flight data goes into **`gl.nondet.exec_prompt(prompt, response_format="json")`**, which is told to use *only* factual data (return `0` if unavailable, never fabricate) and reply `{"delay_minutes", "reasoning", "source"}`.
4. **Consensus.** The verdict is finalized through **`gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`**. The `validator_fn` re-checks the leader's `gl.vm.Return.calldata` for *structure*: `delay_minutes` is a non-negative int and `reasoning` is a string. Validators agree the reported delay is well-formed, then the contract — not the model — applies the threshold rule.
5. **`read_claim(policy_key)`** — the resolver the `InsurancePool` EVM contract reads to issue a payout (`payable`, `holder`, `flight`, `delay`). `get_policy` and `stats` are views.

## Why GenLayer

A deterministic EVM cannot know whether BA248 was late. Solidity has no opcode to read a flight-status page, and a single hardcoded oracle is exactly the trusted third party parametric insurance is meant to remove — it could lie, go offline, or be bribed. Two nodes querying a live tracker at different moments would also disagree and break consensus. FlightShield needs validators to independently fetch the real-world fact and *agree* on it before money moves.

GenLayer's **Optimistic Democracy** provides that: a leader validator reports the delay, others re-verify it against their own fetch, and the value finalizes when a supermajority agrees it is *reasonable*. The deterministic part — "is the delay ≥ the threshold?" — stays in plain contract code, where it belongs.

**Use GenLayer when** the trigger is an off-chain fact that must be fetched and agreed upon trustlessly (did this flight slip 120 minutes?). **Use a plain backend when** everything needed is already on-chain — which is why the threshold comparison and the `InsurancePool` payout logic are deterministic and only the *fact* comes from GenLayer.

## Architecture

| Intelligent contract (GenLayer) | Frontend dir | EVM / off-chain |
| --- | --- | --- |
| `protocol/flight_shield.py` — `FlightShield(gl.Contract)`: `buy_policy`, `file_claim`, `read_claim`, delay verification via `run_nondet_unsafe` | `interface/` (Vite + React + TS) | `protocol/InsurancePool.sol` — issues payout on `read_claim`; flight status crawled off-chain by validators |

## Tech

**Contract** — GenVM Python, pinned to `py-genlayer:1jb45aa8…jpz09h6` via the `# { "Depends": ... }` header. State is a single `policies: TreeMap[str, str]` store with `u256` counters (`policy_count`, `claims_paid`, `claims_denied`); each policy is a JSON blob carrying the threshold, the found delay, and the verdict reasoning/source. Delay verification runs as a `leader_fn`/`validator_fn` pair through `gl.vm.run_nondet_unsafe`, with the flight page crawled via `gl.nondet.web.render`.

**Frontend** — Vite + React 19 + TypeScript with Tailwind v4, `framer-motion`, and `sonner`. `src/genlayer.ts` wraps `genlayer-js`: reads via `createClient({ chain: testnetBradbury }).readContract`; writes connect MetaMask (`eth_requestAccounts`), switch the wallet to chain `0x107d` (4221) via `wallet_switchEthereumChain`/`wallet_addEthereumChain` (no GenLayer snap required), then `writeContract` and await a `FINALIZED` receipt. The UI is an **airport departure-board** terminal: an animated split-flap row renderer (`FlapText`/`FlapCell`) for each policy, a live clock, an ALL/DELAYED filter, an "Insure a Flight" side panel with flight-number / date / threshold-slider inputs wired to `buy_policy`, and a "Claim Ticket" panel that fires `file_claim` and shows the oracle verdict, delay found, and PAID OUT / DENIED status. Policies and `stats` load from chain on mount.

## Project structure

```
FlightShield/
├── protocol/
│   ├── flight_shield.py      # FlightShield(gl.Contract) — intelligent contract
│   └── InsurancePool.sol     # EVM pool, issues payout on read_claim
├── interface/                # frontend (Vite + React + TS)
│   ├── src/
│   │   ├── App.tsx           # split-flap departure board + claim ticket
│   │   ├── genlayer.ts       # genlayer-js reads + MetaMask writes
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

## Develop

```bash
cd interface
npm install
npm run dev      # local dev server
npm run build    # tsc -b && vite build → dist/
```

## Deploy the frontend

Deployed on **Cloudflare Pages**:

- **Root directory:** `interface`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment:** `NODE_VERSION=20`

## Why GenLayer (engineering notes)

- **No floats.** Delays, thresholds, and counters are integers (`delay_minutes`, `threshold_min`, `u256`). The threshold is clamped `30–480`. Keep premiums/payouts in integer wei or basis points — never floats in contract state.
- **Validate structure, not exact match.** `validator_fn` only confirms `delay_minutes` is a non-negative int and `reasoning` is a string. It never matches the leader's prose; the deterministic threshold check is applied by the contract afterwards, not by the LLM.
- **ACCEPTED ≠ executed.** A finalized `file_claim` means validators agreed the reported delay is reasonable; no funds move until `InsurancePool` reads `read_claim` and pays out.
- **Optimistic finality paces writes.** A claim is only trustworthy after the appeal window — the frontend waits for a `FINALIZED` receipt (retries 60 × 5s), so buying or claiming takes ~30–60s. Don't settle before finality.
- **Evidence is untrusted / greybox.** A public flight-status page is open-web input — it can be stale, rate-limited, or unreachable. The prompt forces "use only factual data, return 0 if unavailable, never fabricate," and fetched text is capped. Treat every crawled page as hostile.

## License

MIT
