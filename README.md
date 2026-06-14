# FlightShield

Parametric flight delay insurance on GenLayer. Buy a policy, file a claim, and AI validators fetch real flight data to verify the delay. No paperwork, no adjusters, instant settlement.

## Why GenLayer

Flight delay verification is a judgment problem disguised as a data problem:

- **A deterministic VM can't fetch live flight data.** Solidity has no internet access. Traditional parametric insurance relies on a single oracle feeding delay data — one feed goes down or gets manipulated, claims fail silently.
- **GenLayer validators fetch flight status directly** from public sources using `gl.nondet.web.render`. No middleman oracle to trust, bribe, or maintain.
- **Multiple validators independently verify the same flight.** If one validator's fetch fails or returns stale data, the others catch it through consensus. No single point of failure.
- **The judgment handles ambiguity.** "Was the flight delayed?" sounds simple, but edge cases abound: was it a gate delay or a tarmac delay? Did it depart late but arrive on time? AI validators can interpret these nuances; a simple data feed cannot.
- **No adjuster, no paperwork.** The contract fetches, judges, and settles in one transaction. Traditional insurance takes weeks and a human claims adjuster.

The EVM pool holds premiums and pays claims. GenLayer verifies the real-world event that triggers the payout.

## How it works

1. **Buy policy** — specify flight number, date, and delay threshold (minutes)
2. **Flight delayed?** — file a claim
3. **AI validators** fetch real flight status from flightstats.com
4. **Delay confirmed** → instant payout from InsurancePool
5. **No delay found** → claim denied (rule: no data = no payout)

## Deployed

**GenLayer (Bradbury):** `0x75787a83F7742b109e5BF723cA9d369CB1DA411B`

## Structure

```
FlightShield/
├── protocol/
│   ├── flight_shield.py       ← GenLayer contract
│   └── InsurancePool.sol      ← Solidity (Remix-deployable)
├── interface/
│   └── index.html             ← Vanilla HTML/JS (no framework)
└── .gitignore
```

That's it. No monorepo. No build tools. No package manager config. No framework.

- `protocol/` = all smart contracts (both GenLayer and Solidity, side by side)
- `interface/` = single HTML file with Tailwind CDN
- Deploy Solidity on Remix. Deploy Python via `genlayer deploy`. Open HTML in browser.

## Why this minimal?

Insurance is trust infrastructure. The code should be auditable in 5 minutes. No hidden complexity behind build tooling. Everything is readable in-place.
