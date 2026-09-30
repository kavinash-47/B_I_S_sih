from app.services.audit_service import log_action, get_audit_trail, verify_audit_chain
from app.core.database import db_session


def _make_tender():
    with db_session() as conn:
        cur = conn.execute("INSERT INTO tenders (original_text) VALUES ('test')")
        return cur.lastrowid


def test_chain_valid_after_multiple_actions():
    tid = _make_tender()
    log_action(tid, "r1", "accept", new_value="IS 269")
    log_action(tid, "r2", "reject", new_value="IS 8112", reason="outdated")
    log_action(tid, "r3", "note", new_value="checked twice")
    result = verify_audit_chain(tid)
    assert result["valid"] is True
    assert result["records_checked"] == 3


def test_tampering_detected():
    tid = _make_tender()
    log_action(tid, "r1", "accept", new_value="IS 269")
    with db_session() as conn:
        conn.execute("UPDATE audit_log SET new_value = 'TAMPERED' WHERE tender_id = ?", (tid,))
    result = verify_audit_chain(tid)
    assert result["valid"] is False


def test_first_record_links_to_genesis():
    tid = _make_tender()
    log_action(tid, "r1", "accept", new_value="x")
    trail = get_audit_trail(tid)
    assert trail[0]["prev_hash"] == "GENESIS"


def test_hash_chain_links_correctly():
    tid = _make_tender()
    log_action(tid, "r1", "accept", new_value="x")
    log_action(tid, "r2", "accept", new_value="y")
    trail = get_audit_trail(tid)
    assert trail[1]["prev_hash"] == trail[0]["this_hash"]


def test_empty_tender_chain_is_valid():
    tid = _make_tender()
    result = verify_audit_chain(tid)
    assert result["valid"] is True
    assert result["records_checked"] == 0


def test_export_before_after_endpoint_and_download():
    import os
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    tid = _make_tender()

    res = client.post("/api/export/before-after", json={
        "tender_id": tid,
        "original_text": "Supply 1.1 kV cable conforming to IS 694.",
        "revised_text": "Supply 1.1 kV cable conforming to IS 694:2010.",
    })
    assert res.status_code == 200
    data = res.json()
    assert "pdf_report" in data
    pdf_path = data["pdf_report"]
    assert os.path.exists(pdf_path)

    filename = os.path.basename(pdf_path)
    dl_res = client.get(f"/api/export/download/{filename}")
    assert dl_res.status_code == 200
    assert dl_res.headers.get("content-type") == "application/pdf"
    assert len(dl_res.content) > 0


def test_export_before_after_validation():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)

    res = client.post("/api/export/before-after", json={
        "tender_id": 1,
        "original_text": "",
        "revised_text": "Modified text",
    })
    assert res.status_code == 400

