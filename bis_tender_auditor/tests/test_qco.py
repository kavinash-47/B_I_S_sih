from app.services.qco_checker import get_qco_status


def test_known_qco_found():
    result = get_qco_status(is_number="IS 17631")
    assert result["found"] is True
    assert len(result["results"]) == 1


def test_unknown_product_not_fabricated():
    result = get_qco_status(product="Nonexistent Product Category XYZ")
    assert result["found"] is False
    assert "unavailable" in result["message"].lower()


def test_no_product_or_is_number_raises_message():
    result = get_qco_status()
    assert result["found"] is False


def test_date_aware_before_effective():
    result = get_qco_status(is_number="IS 17631", on_date="2020-01-01")
    assert result["found"] is True
    assert result["results"][0]["status_as_of_requested_date"] == "not yet effective"
