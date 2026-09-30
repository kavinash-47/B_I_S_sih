"""
Contradiction + Unit Checker, using `pint` for real unit conversion/comparison.
Never auto-corrects the tender text -- only flags for officer review.
"""
import re
import pint

ureg = pint.UnitRegistry()

MIN_MAX_RE = re.compile(
    r"(min(?:imum)?)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s?(\w+).{0,80}?"
    r"(max(?:imum)?)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s?(\w+)",
    re.IGNORECASE | re.DOTALL,
)

UNIT_ALIASES = {"mpa": "MPa", "v": "volt", "kg": "kg", "mm": "mm", "w": "watt", "lm": "lm"}


def _to_pint_unit(u: str):
    u = u.lower()
    return UNIT_ALIASES.get(u, u)


def check_contradictions(text: str) -> list:
    findings = []
    for m in MIN_MAX_RE.finditer(text):
        min_val, min_unit = float(m.group(2)), _to_pint_unit(m.group(3))
        max_val, max_unit = float(m.group(5)), _to_pint_unit(m.group(6))
        try:
            min_q = ureg.Quantity(min_val, min_unit)
            max_q = ureg.Quantity(max_val, max_unit)
            min_q_conv = min_q.to(max_q.units)
            if min_q_conv.magnitude > max_q.magnitude:
                findings.append({
                    "type": "CONTRADICTION",
                    "minimum": f"{min_val} {min_unit}",
                    "maximum": f"{max_val} {max_unit}",
                    "detail": f"Minimum ({min_q_conv}) exceeds maximum ({max_q}).",
                    "source_text": m.group(0),
                    "action": "Flagged for officer review. Not auto-corrected.",
                })
        except pint.errors.DimensionalityError:
            findings.append({
                "type": "INCOMPATIBLE_UNITS",
                "minimum": f"{min_val} {min_unit}",
                "maximum": f"{max_val} {max_unit}",
                "detail": f"'{min_unit}' and '{max_unit}' are not compatible units — cannot compare.",
                "source_text": m.group(0),
                "action": "Flagged for officer review.",
            })
        except Exception as e:
            findings.append({
                "type": "UNIT_PARSE_ERROR",
                "detail": str(e),
                "source_text": m.group(0),
                "action": "Flagged for officer review.",
            })
    return findings
