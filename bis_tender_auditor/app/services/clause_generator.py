"""
Specification Clause Generator.
Only ever pulls from verified catalogue data. Every generated clause is
tagged so the officer can see which parts are database facts and which
parts are AI-drafted wording, and is invited to edit before use.
"""
from app.core.database import db_session


def generate_clause(is_number: str, part: str = None) -> dict:
    with db_session() as conn:
        row = conn.execute(
            "SELECT * FROM standards WHERE is_number = ? AND (part = ? OR (? IS NULL AND part IS NULL))",
            (is_number, part, part)
        ).fetchone()

    if not row:
        return {"found": False,
                "message": f"{is_number} not in local database. Cannot generate a clause "
                           "without verified catalogue data."}

    row = dict(row)
    part_str = f" ({row['part']})" if row["part"] else ""
    verified_facts = {
        "is_number": row["is_number"],
        "part": row["part"],
        "year": row["year"],
        "title": row["title"],
        "status": row["status"],
        "source_url": row["source_url"],
    }

    if row["status"] in ("withdrawn", "superseded"):
        drafted = (f"The item shall conform to {row['is_number']}{part_str}:{row['year']} — "
                   f"{row['title']}. NOTE: this edition is recorded as {row['status']} in the "
                   f"local database" +
                   (f" (see {row['superseded_by']})" if row.get("superseded_by") else "") +
                   " — confirm the current edition before using this clause.")
    else:
        drafted = (f"The item shall conform to {row['is_number']}{part_str}:{row['year']} — "
                   f"{row['title']}.")

    return {
        "found": True,
        "verified_catalogue_information": verified_facts,
        "ai_generated_drafting_language": drafted,
        "editable_by_officer": True,
        "note": "This clause is drafted from catalogue metadata only. It contains no "
                "invented IS numbers, titles, or legal requirements. Review and edit "
                "before inserting into a tender document.",
    }
