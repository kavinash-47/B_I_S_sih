"""
Standards Bundle: given a main standard, return linked standards
(test method / material / safety / referenced) from standard_edges.
Only returns what's actually in the database.
"""
from app.core.database import db_session


def get_related_standards(is_number: str) -> dict:
    with db_session() as conn:
        rows = conn.execute(
            "SELECT * FROM standard_edges WHERE source_is_number = ?", (is_number,)
        ).fetchall()
    if not rows:
        return {"is_number": is_number, "related": [],
                "message": "No linked standards recorded in the local database."}
    return {"is_number": is_number,
            "related": [dict(r) for r in rows]}
