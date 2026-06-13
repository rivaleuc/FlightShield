# FlightShield

Parametric flight delay insurance on GenLayer. Buy a policy, file a claim, and AI validators fetch real flight data to verify the delay. No paperwork, no adjusters, instant settlement.

## How it works

1. **Buy policy** — specify flight number, date, and delay threshold (minutes)
2. **Flight delayed?** — file a claim
3. **AI validators** fetch real flight status from flightstats.com
4. **Delay confirmed** → instant payout from InsurancePool
5. **No delay found** → claim denied (rule: no data = no payout)

## Deployed

**GenLayer (Bradbury):** `0x75787a83F7742b109e5BF723cA9d369CB1DA411B`

## Test result

Policy: BA287, 2025-06-10, threshold 120min
→ AI fetched flightstats, found "Flight Status Not Available / DATE IS OUT OF RANGE"
→ **Denied** (correctly: no data = 0 delay)

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
