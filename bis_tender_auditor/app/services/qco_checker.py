"""
Dated QCO Checker. Date-aware: given a target date, reports whether a QCO
was issued/effective/withdrawn as of that date, using only real dates
found in qco_events. Never invents a legal status.
"""
from datetime import date as date_cls, datetime
from app.core.database import db_session


def _parse(d):
    if not d:
        return None
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except ValueError:
        return None


def get_qco_status(product: str = None, is_number: str = None, on_date: str = None) -> dict:
    if not product and not is_number:
        return {"found": False, "message": "Provide a product name or an IS number."}

    query = "SELECT * FROM qco_events WHERE 1=1"
    params = []
    if is_number:
        query += " AND is_number = ?"
        params.append(is_number)
    if product:
        query += " AND product_category LIKE ?"
        params.append(f"%{product}%")

    with db_session() as conn:
        rows = [dict(r) for r in conn.execute(query, params).fetchall()]

    if not rows:
        return {"found": False,
                "message": "QCO information unavailable — manual verification required."}

    target = _parse(on_date) if on_date else date_cls.today()
    results = []
    for r in rows:
        eff = _parse(r.get("effective_date"))
        wd = _parse(r.get("withdrawal_date"))
        if wd and target >= wd:
            status_as_of_date = "withdrawn"
        elif eff and target < eff:
            status_as_of_date = "not yet effective"
        else:
            status_as_of_date = r["event_type"]
        results.append({
            "qco_name": r["qco_name"],
            "product_category": r["product_category"],
            "is_number": r["is_number"],
            "event_type": r["event_type"],
            "effective_date": r["effective_date"],
            "withdrawal_date": r["withdrawal_date"],
            "status_as_of_requested_date": status_as_of_date,
            "source_url": r["source_url"],
            "verification": r["verification"],
            "notes": r["notes"],
        })

    return {"found": True, "as_of_date": str(target), "results": results,
            "advisory": "QCO may apply — please verify against the official gazette notification."}
