from app.services.contradiction_checker import check_contradictions


def test_detects_min_greater_than_max():
    findings = check_contradictions("minimum 500 kg maximum 100 kg required")
    assert any(f["type"] == "CONTRADICTION" for f in findings)


def test_no_contradiction_when_min_less_than_max():
    findings = check_contradictions("minimum 100 kg maximum 500 kg required")
    assert not any(f["type"] == "CONTRADICTION" for f in findings)


def test_incompatible_units_flagged():
    findings = check_contradictions("minimum 500 kg maximum 100 V required")
    assert any(f["type"] == "INCOMPATIBLE_UNITS" for f in findings)


def test_no_min_max_pattern_returns_empty():
    assert check_contradictions("Supply of cement bags") == []


def test_does_not_modify_input_text():
    text = "minimum 500 kg maximum 100 kg"
    check_contradictions(text)
    assert text == "minimum 500 kg maximum 100 kg"
