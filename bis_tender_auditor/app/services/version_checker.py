"""
Standard Version / Merger Checker.

check_standard_version(is_number, date=None) looks the standard up in
`standards` first (for its own status), then in `standard_versions` for
any newer replacement. Never invents a relationship that isn't in the
database.
"""
from app.core.database import db_session


def _base_number(is_number: str) -> str:
    """Strips a trailing ':YYYY' year suffix, e.g. 'IS 8112:2013' -> 'IS 8112'."""
    return is_number.split(":")[0].strip()


def check_standard_version(is_number: str, date: str = None) -> dict:
    base = _base_number(is_number)
    with db_session() as conn:
        std = conn.execute(
            "SELECT * FROM standards WHERE is_number = ? ORDER BY year DESC LIMIT 1",
            (base,)
        ).fetchone()
        version_row = conn.execute(
            "SELECT * FROM standard_versions WHERE old_is_number = ?",
            (base,)
        ).fetchone()

    if not std and not version_row:
        return {
            "is_number": is_number,
            "found": False,
            "message": "Standard not found in local database — cannot determine version status.",
        }

    result = {
        "is_number": is_number,
        "found": True,
        "current_status": std["status"] if std else "unknown (only found in version table)",
        "action": "No action needed.",
    }

    if version_row:
        v = dict(version_row)
        result.update({
            "replacement_is_number": v["new_is_number"],
            "relationship_type": v["relationship_type"],
            "effective_date": v["effective_date"],
            "date_reliability": v["date_reliability"],
            "source_url": v["source_url"],
            "notes": v["notes"],
            "action": f"Review current replacement: {v['new_is_number']}.",
        })
        if v["date_reliability"] in ("unknown", "unverified", None):
            result["date_warning"] = ("No confirmed legal effective date for this "
                                       "replacement — do not present the stored date "
                                       "(if any) as authoritative.")
    elif std and std["status"] in ("withdrawn", "superseded"):
        result["action"] = ("Standard is marked "
                             f"{std['status']} but no replacement is recorded in the "
                             "local database — manual check required.")

    return result
