from app.services.requirement_extractor import extract_requirements, extract_cited_is_numbers


def test_extracts_is_number():
    reqs = extract_requirements("The cable shall conform to IS 694:2010.")
    types = [r["req_type"] for r in reqs]
    assert "cited_is_number" in types


def test_extracts_voltage():
    reqs = extract_requirements("Rated 450/750V PVC cable")
    assert any(r["req_type"] == "voltage" for r in reqs)


def test_extracts_range():
    reqs = extract_requirements("minimum 500 kg maximum 100 kg")
    ranges = [r for r in reqs if r["req_type"] == "range"]
    assert len(ranges) == 2


def test_empty_text_returns_empty_list():
    assert extract_requirements("") == []


def test_source_text_matches_original():
    text = "Voltage rating: 450/750V required."
    reqs = extract_requirements(text)
    for r in reqs:
        assert text[r["char_start"]:r["char_end"]] == r["source_text"]


def test_cited_is_numbers_normalizes():
    nums = extract_cited_is_numbers("Cites IS 8112:2013 and IS269")
    assert "IS 8112:2013" in nums
    assert "IS 269" in nums
