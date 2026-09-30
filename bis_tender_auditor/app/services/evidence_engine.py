"""
Evidence + "Why Not?" module.

The database has no clause-level text (only titles/scope summaries), so
every evidence response is explicit about exactly that limit, per the
"do not fabricate clause text" rule.
"""
from app.core.database import db_session


def get_evidence(is_number: str, part: str = None) -> dict:
    with db_session() as conn:
        row = conn.execute(
            "SELECT * FROM standards WHERE is_number = ? AND (part = ? OR (? IS NULL AND part IS NULL))",
            (is_number, part, part)
        ).fetchone()
    if not row:
        return {"is_number": is_number, "found": False,
                "message": "Standard not in local database — cannot provide evidence."}
    row = dict(row)
    return {
        "is_number": row["is_number"],
        "part": row["part"],
        "title": row["title"],
        "status": row["status"],
        "scope_summary": row["scope_summary"] or "Evidence unavailable in local standards dataset.",
        "clause_text": "Evidence unavailable in local standards dataset.",
        "source_url": row["source_url"],
        "verification": row["verification"],
        "retrieved_on": row["retrieved_on"],
        "found": True,
    }


WHY_NOT_REASONS = {
    "superseded": "Standard is superseded by {replacement}.",
    "withdrawn": "Standard has been withdrawn.",
    "low_bm25": "Keyword overlap with the tender requirement is low.",
    "low_semantic": "Semantic similarity is insufficient.",
    "family_mismatch": "Product/material family does not match the tender requirement.",
}


def why_not(candidate: dict, requirement_text: str) -> str:
    """Builds a plain-language reason a candidate was NOT the top pick."""
    if candidate.get("status") in ("withdrawn", "superseded"):
        repl = candidate.get("superseded_by") or "an unspecified newer edition"
        return WHY_NOT_REASONS["superseded"].format(replacement=repl)
    if candidate.get("bm25_score", 1) < 0.1:
        return WHY_NOT_REASONS["low_bm25"]
    if candidate.get("semantic_score", 1) < 0.1:
        return WHY_NOT_REASONS["low_semantic"]
    return "Did not rank in the top results for this requirement."
