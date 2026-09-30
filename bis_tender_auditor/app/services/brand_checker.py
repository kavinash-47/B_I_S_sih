"""
Brand Neutrality Checker. Advisory only -- flags brand-specific wording
and checks for "or equivalent" nearby. Makes no legal conclusion.
"""
import re
from app.core.database import db_session

EQUIVALENT_RE = re.compile(r"or\s+equivalent", re.IGNORECASE)


def check_brand_neutrality(text: str) -> list:
    with db_session() as conn:
        brands = [dict(r) for r in conn.execute("SELECT DISTINCT brand_name FROM brands").fetchall()]

    findings = []
    lower_text = text.lower()
    for b in brands:
        name = b["brand_name"]
        pattern = re.compile(r"\b" + re.escape(name) + r"\b", re.IGNORECASE)
        for m in pattern.finditer(text):
            window = text[max(0, m.start() - 40):m.end() + 40]
            has_equivalent = bool(EQUIVALENT_RE.search(window))
            findings.append({
                "type": "BRAND_SPECIFIC_WORDING",
                "brand": name,
                "context": window.strip(),
                "or_equivalent_detected": has_equivalent,
                "action": ("Officer review required."
                           if not has_equivalent else
                           "'or equivalent' present nearby — lower priority, still review."),
            })
    return findings
