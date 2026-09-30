from app.services.clause_generator import generate_clause


def test_generates_clause_for_known_standard():
    result = generate_clause("IS 269")
    assert result["found"] is True
    assert "IS 269" in result["ai_generated_drafting_language"]
    assert result["verified_catalogue_information"]["title"]


def test_unknown_standard_returns_not_found():
    result = generate_clause("IS 00000")
    assert result["found"] is False


def test_withdrawn_standard_includes_warning():
    result = generate_clause("IS 8112")
    assert result["found"] is True
    assert "withdrawn" in result["ai_generated_drafting_language"].lower()


def test_never_fabricates_missing_fields():
    result = generate_clause("IS 269")
    facts = result["verified_catalogue_information"]
    # every fact must trace to something actually in the DB fixture
    assert facts["title"] == "Ordinary portland cement - Specification"
