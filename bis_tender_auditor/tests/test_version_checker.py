from app.services.version_checker import check_standard_version


def test_withdrawn_standard_has_replacement():
    result = check_standard_version("IS 8112")
    assert result["found"] is True
    assert result["current_status"] == "withdrawn"
    assert result["replacement_is_number"] == "IS 269"


def test_year_suffix_is_handled():
    result = check_standard_version("IS 8112:2013")
    assert result["found"] is True
    assert result["replacement_is_number"] == "IS 269"


def test_unknown_standard_not_fabricated():
    result = check_standard_version("IS 00000")
    assert result["found"] is False
    assert "not found" in result["message"].lower()


def test_current_standard_no_action_needed():
    result = check_standard_version("IS 269")
    assert result["found"] is True
    assert result["current_status"] == "in_force"
    assert "no action" in result["action"].lower()


def test_no_fabricated_date_when_unreliable():
    result = check_standard_version("IS 8112")
    assert "date_warning" in result
