"""
Tamper-evident audit log. Each record's hash = SHA-256(previous_hash +
timestamp + action + record_id + new_value). verify_audit_chain() walks
the whole chain and reports the first broken link, if any.
"""
import hashlib
from datetime import datetime, timezone
from app.core.database import db_session


def _hash(prev_hash, timestamp, action, record_id, new_value):
    payload = f"{prev_hash}|{timestamp}|{action}|{record_id}|{new_value}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _get_last_hash(conn, tender_id):
    row = conn.execute(
        "SELECT this_hash FROM audit_log WHERE tender_id = ? ORDER BY id DESC LIMIT 1",
        (tender_id,)
    ).fetchone()
    return row["this_hash"] if row else "GENESIS"


def log_action(tender_id, record_id, action, previous_value=None, new_value=None,
                reason=None, officer=None):
    timestamp = datetime.now(timezone.utc).isoformat()
    with db_session() as conn:
        prev_hash = _get_last_hash(conn, tender_id)
        this_hash = _hash(prev_hash, timestamp, action, record_id, new_value)
        cur = conn.execute(
            """INSERT INTO audit_log
               (tender_id, record_id, action, previous_value, new_value, reason,
                officer, timestamp, prev_hash, this_hash)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (tender_id, record_id, action, previous_value, new_value, reason,
             officer, timestamp, prev_hash, this_hash)
        )
        return {"id": cur.lastrowid, "timestamp": timestamp, "this_hash": this_hash}


def get_audit_trail(tender_id):
    with db_session() as conn:
        rows = conn.execute(
            "SELECT * FROM audit_log WHERE tender_id = ? ORDER BY id ASC", (tender_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def verify_audit_chain(tender_id):
    rows = get_audit_trail(tender_id)
    expected_prev = "GENESIS"
    for r in rows:
        if r["prev_hash"] != expected_prev:
            return {"valid": False, "broken_at_record_id": r["id"],
                     "reason": "prev_hash does not match the previous record's hash."}
        recomputed = _hash(r["prev_hash"], r["timestamp"], r["action"], r["record_id"], r["new_value"])
        if recomputed != r["this_hash"]:
            return {"valid": False, "broken_at_record_id": r["id"],
                     "reason": "Stored hash does not match recomputed hash — record was altered."}
        expected_prev = r["this_hash"]
    return {"valid": True, "records_checked": len(rows)}
