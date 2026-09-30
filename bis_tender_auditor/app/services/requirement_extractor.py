"""
Tender Analyzer / Requirement Extractor.

Rule-based (regex) extraction -- deliberately NOT an LLM, so it is fully
offline, deterministic, and every extracted value can be traced back to
the exact characters in the source text (required by the "preserve
evidence locations" and "offline CPU" requirements).

This is intentionally simple. It will miss requirements phrased in ways
the patterns don't cover -- that is a known limitation, not a hidden one.
"""
import re

IS_NUMBER_RE = re.compile(r"\bIS\s?(\d{2,6})(?:\s?\(Part\s?\d+\))?(?::(\d{4}))?\b", re.IGNORECASE)
VOLTAGE_RE = re.compile(r"(\d{2,5})\s?(?:/\s?(\d{2,5}))?\s?V\b", re.IGNORECASE)
DIMENSION_RE = re.compile(r"(\d+(?:\.\d+)?)\s?(mm|cm|m|sq\.?\s?mm|sqmm)\b", re.IGNORECASE)
QUANTITY_RE = re.compile(r"(\d+(?:,\d{3})*(?:\.\d+)?)\s?(nos|numbers|units|bags|tonnes|kg|litres|meters|metres)\b", re.IGNORECASE)
GRADE_RE = re.compile(r"\b(Fe\s?\d{3}D?|Grade\s?\d{1,3}|OPC\s?\d{2}|Class\s?\d)\b", re.IGNORECASE)
DATE_RE = re.compile(r"\b(\d{1,2}[\s\-/](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s\-/]\d{2,4})\b", re.IGNORECASE)
RANGE_RE = re.compile(r"(min(?:imum)?|max(?:imum)?)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s?(kg|mpa|v|mm|w|lm)?", re.IGNORECASE)


def extract_requirements(text: str) -> list:
    """
    Returns a list of dicts: {req_type, value, unit, source_text, char_start, char_end}
    Every requirement carries the exact substring it was extracted from, and its
    character offsets in the original text -- so a UI can highlight it.
    """
    requirements = []

    def add(req_type, match, value=None, unit=None):
        requirements.append({
            "req_type": req_type,
            "value": value if value is not None else match.group(0),
            "unit": unit,
            "source_text": match.group(0),
            "char_start": match.start(),
            "char_end": match.end(),
        })

    for m in IS_NUMBER_RE.finditer(text):
        add("cited_is_number", m)
    for m in VOLTAGE_RE.finditer(text):
        add("voltage", m, unit="V")
    for m in DIMENSION_RE.finditer(text):
        add("dimension", m, value=m.group(1), unit=m.group(2))
    for m in QUANTITY_RE.finditer(text):
        add("quantity", m, value=m.group(1), unit=m.group(2))
    for m in GRADE_RE.finditer(text):
        add("grade", m)
    for m in DATE_RE.finditer(text):
        add("date", m)
    for m in RANGE_RE.finditer(text):
        add("range", m, value=m.group(2), unit=(m.group(3) or None))

    return requirements


def extract_cited_is_numbers(text: str) -> list:
    """Convenience helper: just the normalized 'IS <number>' strings cited."""
    out = []
    for m in IS_NUMBER_RE.finditer(text):
        num = m.group(1)
        year = m.group(2)
        norm = f"IS {num}" + (f":{year}" if year else "")
        out.append(norm)
    return out
