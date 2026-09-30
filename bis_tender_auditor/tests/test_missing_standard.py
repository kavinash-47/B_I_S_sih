from app.services.missing_standard import check_completeness


def test_unknown_family_returns_no_checklist():
    result = check_completeness("Nonexistent Family", [])
    assert result["checklist_found"] is False


def test_known_family_with_no_requirements_all_missing():
    result = check_completeness("PVC cables", [])
    assert result["checklist_found"] is True
    assert result["missing_required_count"] > 0


def test_covered_requirement_marked_ok():
    reqs = [{"req_type": "voltage", "value": "450/750V", "unit": "V", "source_text": "voltage rating 450V"}]
    result = check_completeness("PVC cables", reqs)
    voltage_item = next(i for i in result["items"] if i["requirement"] == "voltage_rating")
    assert voltage_item["status"] == "OK"
