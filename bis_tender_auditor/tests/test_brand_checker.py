from app.services.brand_checker import check_brand_neutrality


def test_detects_brand_name():
    findings = check_brand_neutrality("Make: Polycab only.")
    assert any(f["brand"] == "Polycab" for f in findings)


def test_word_boundary_no_false_positive_substring():
    # "Polycab" should not match inside an unrelated longer word
    findings = check_brand_neutrality("Polycabinet manufacturing unit required.")
    assert findings == []


def test_or_equivalent_detected():
    findings = check_brand_neutrality("Make: Polycab or equivalent approved make.")
    assert findings[0]["or_equivalent_detected"] is True


def test_or_equivalent_absent():
    findings = check_brand_neutrality("Make: Polycab only, no substitute accepted.")
    assert findings[0]["or_equivalent_detected"] is False


def test_no_brand_mentioned():
    assert check_brand_neutrality("Supply of generic cable.") == []
