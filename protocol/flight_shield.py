# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from genlayer import *


class FlightShield(gl.Contract):
    admin: str
    policies: TreeMap[str, str]
    policy_count: u256
    claims_paid: u256
    claims_denied: u256

    def __init__(self):
        self.admin = str(gl.message.sender_address)
        self.policy_count = u256(0)
        self.claims_paid = u256(0)
        self.claims_denied = u256(0)

    @gl.public.write
    def buy_policy(self, flight_number: str, departure_date: str, delay_threshold_minutes: int) -> str:
        """Buy a parametric flight delay insurance policy."""
        flight_number = str(flight_number).strip().upper()
        departure_date = str(departure_date).strip()
        if not flight_number or not departure_date:
            raise Exception("flight_number and departure_date required")
        threshold = max(30, min(480, int(delay_threshold_minutes)))

        key = str(int(self.policy_count))
        policy = {
            "holder": str(gl.message.sender_address),
            "flight": flight_number,
            "date": departure_date,
            "threshold_min": threshold,
            "status": "active",  # active, claimed, denied, expired
            "delay_found": 0,
            "reasoning": "",
            "source": "",
        }
        self.policies[key] = json.dumps(policy)
        self.policy_count += u256(1)
        return key

    @gl.public.write
    def file_claim(self, policy_key: str) -> None:
        """File a claim — AI validators check if the flight was actually delayed."""
        policy_key = str(policy_key)
        if policy_key not in self.policies:
            raise Exception("unknown policy")
        policy = json.loads(self.policies[policy_key])
        if policy["status"] != "active":
            raise Exception("policy not active")
        if str(gl.message.sender_address) != policy["holder"]:
            raise Exception("only holder can claim")

        verdict = self._check_flight(policy)
        policy["delay_found"] = verdict["delay_minutes"]
        policy["eligible"] = verdict["eligible"]
        policy["reasoning"] = verdict["reasoning"]
        policy["source"] = verdict["source"]

        if verdict["delay_minutes"] >= policy["threshold_min"]:
            policy["status"] = "claimed"
            self.claims_paid += u256(1)
        else:
            policy["status"] = "denied"
            self.claims_denied += u256(1)

        self.policies[policy_key] = json.dumps(policy)

    def _check_flight(self, policy: dict) -> dict:
        flight = policy["flight"]
        date = policy["date"]
        # Capture the policy's threshold into the closure so the anchor
        # (eligible == delay >= threshold) is deterministic for this claim.
        threshold_min = int(policy["threshold_min"])

        def leader_fn() -> str:
            # Try to fetch flight status from a public source
            flight_data = "(no flight data available)"
            try:
                url = f"https://www.flightstats.com/v2/flight-tracker/{flight[:2]}/{flight[2:]}?year={date[:4]}&month={date[5:7]}&date={date[8:10]}"
                raw = gl.nondet.web.render(url, mode="text", wait_after_loaded="3s")
                flight_data = raw[:4000]
            except Exception:
                pass

            prompt = f"""You are a parametric insurance claim validator for flight delays.

FLIGHT: {flight}
DATE: {date}
DELAY THRESHOLD: {policy['threshold_min']} minutes

FLIGHT DATA FETCHED:
{flight_data}

RULES:
1. Determine the actual departure delay in minutes (0 if on time or early).
2. Use ONLY factual data from the fetched source. If data is unavailable, return delay_minutes: 0.
3. Do NOT guess or fabricate delay information.
4. Include the source of your information.

Reply ONLY valid JSON:
{{"delay_minutes": <integer>, "reasoning": "<explanation>", "source": "<where you found this>"}}
No markdown."""

            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            data = raw if isinstance(raw, dict) else json.loads(str(raw).strip())

            # Deterministic normalization + anchor. Coerce delay to a clean int
            # in [0, 6000], then DERIVE eligible from the captured threshold so
            # honest leaders always satisfy the validator invariant.
            mins = data.get("delay_minutes")
            if isinstance(mins, bool) or not isinstance(mins, int):
                try:
                    mins = int(mins)
                except Exception:
                    mins = 0
            if mins < 0:
                mins = 0
            if mins > 6000:
                mins = 6000
            reasoning = str(data.get("reasoning", "")).strip()
            if not reasoning:
                reasoning = "no reasoning provided"
            source = str(data.get("source", "")).strip() or "unknown"
            eligible = mins >= threshold_min
            return json.dumps({
                "delay_minutes": mins,
                "eligible": eligible,
                "reasoning": reasoning,
                "source": source,
            })

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                data = json.loads(leader_result.calldata)
                mins = data.get("delay_minutes")
                # int field guard: reject bool (bool is an int subclass).
                if isinstance(mins, bool) or not isinstance(mins, int):
                    return False
                if mins < 0 or mins > 6000:
                    return False
                eligible = data.get("eligible")
                if not isinstance(eligible, bool):
                    return False
                # Cross-field invariant (the ANCHOR): eligible iff delay >= threshold.
                if eligible != (mins >= threshold_min):
                    return False
                reasoning = data.get("reasoning")
                if not isinstance(reasoning, str) or not reasoning.strip():
                    return False
                return True
            except Exception:
                return False

        result_str = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        return json.loads(result_str)

    # -- Views --

    @gl.public.view
    def get_policy(self, key: str) -> dict:
        key = str(key)
        if key not in self.policies:
            return {"exists": False}
        return json.loads(self.policies[key])

    @gl.public.view
    def read_claim(self, key: str) -> dict:
        """InsurancePool reads this to issue payout."""
        key = str(key)
        if key not in self.policies:
            return {"payable": False}
        p = json.loads(self.policies[key])
        return {
            "payable": p["status"] == "claimed",
            "holder": p["holder"],
            "flight": p["flight"],
            "delay": p["delay_found"],
        }

    @gl.public.view
    def stats(self) -> dict:
        return {
            "policies": int(self.policy_count),
            "paid": int(self.claims_paid),
            "denied": int(self.claims_denied),
        }
