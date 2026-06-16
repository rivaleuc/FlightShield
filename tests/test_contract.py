"""Tests for FlightShield anchor: eligible == (delay_minutes >= threshold_min)."""
import json

import pytest

THRESHOLD = 120  # buy_policy clamps to [30, 480]


def policy(contract_module, gl_runtime):
    c = contract_module.FlightShield()
    key = c.buy_policy("AA100", "2026-06-16", THRESHOLD)
    return c, key


@pytest.mark.parametrize(
    "delay,expected_eligible,expected_status",
    [
        (0, False, "denied"),
        (119, False, "denied"),
        (120, True, "claimed"),
        (300, True, "claimed"),
        (6000, True, "claimed"),
    ],
)
def test_anchor_and_payout(contract_module, gl_runtime, delay, expected_eligible, expected_status):
    gl_runtime.nondet.exec_prompt = lambda prompt, _d=delay, **kw: {
        "delay_minutes": _d, "reasoning": "from flight tracker source", "source": "flightstats"
    }
    c, key = policy(contract_module, gl_runtime)
    c.file_claim(key)
    p = json.loads(c.policies[key])
    assert p["delay_found"] == delay
    assert p["eligible"] is expected_eligible
    # anchor invariant:
    assert p["eligible"] == (p["delay_found"] >= p["threshold_min"])
    # payout logic preserved:
    assert p["status"] == expected_status


def test_normalized_output_always_validates(contract_module, gl_runtime):
    weird = [
        {"delay_minutes": True, "reasoning": "bool coerced to int"},       # bool -> int
        {"delay_minutes": -50, "reasoning": "clamped up to zero"},          # negative -> 0
        {"delay_minutes": 99999, "reasoning": "clamped down to 6000"},      # huge -> 6000
        {"delay_minutes": "240", "reasoning": "string coerced"},            # str -> int
        {"reasoning": "no delay key"},                                      # missing -> 0
        {"delay_minutes": 130, "reasoning": ""},                            # empty reasoning -> padded
    ]
    for out in weird:
        gl_runtime.nondet.exec_prompt = lambda prompt, _o=out, **kw: dict(_o)
        c, key = policy(contract_module, gl_runtime)
        c.file_claim(key)
        validator = gl_runtime.vm.last_validator
        ret = gl_runtime.vm.Return(gl_runtime.vm.last_leader_result)
        assert validator(ret) is True


def test_validator_rejects_bad_inputs(contract_module, gl_runtime):
    gl_runtime.nondet.exec_prompt = lambda prompt, **kw: {"delay_minutes": 200, "reasoning": "ok ok ok"}
    c, key = policy(contract_module, gl_runtime)
    c.file_claim(key)
    validator = gl_runtime.vm.last_validator
    R = gl_runtime.vm.Return

    bad = [
        "not-a-return",
        R("{bad"),
        # delay is bool
        R(json.dumps({"delay_minutes": True, "eligible": True, "reasoning": "r"})),
        # delay out of range
        R(json.dumps({"delay_minutes": 6001, "eligible": True, "reasoning": "r"})),
        R(json.dumps({"delay_minutes": -1, "eligible": False, "reasoning": "r"})),
        # eligible not bool
        R(json.dumps({"delay_minutes": 200, "eligible": "yes", "reasoning": "r"})),
        # ANCHOR violation: delay >= threshold but eligible False
        R(json.dumps({"delay_minutes": 200, "eligible": False, "reasoning": "r"})),
        # ANCHOR violation: delay < threshold but eligible True
        R(json.dumps({"delay_minutes": 10, "eligible": True, "reasoning": "r"})),
        # empty reasoning
        R(json.dumps({"delay_minutes": 200, "eligible": True, "reasoning": "  "})),
    ]
    for b in bad:
        assert validator(b) is False


def test_good_input_validates(contract_module, gl_runtime):
    gl_runtime.nondet.exec_prompt = lambda prompt, **kw: {"delay_minutes": 200, "reasoning": "ok"}
    c, key = policy(contract_module, gl_runtime)
    c.file_claim(key)
    validator = gl_runtime.vm.last_validator
    R = gl_runtime.vm.Return
    assert validator(R(json.dumps({"delay_minutes": 200, "eligible": True, "reasoning": "delayed"}))) is True
    assert validator(R(json.dumps({"delay_minutes": 30, "eligible": False, "reasoning": "on time"}))) is True
