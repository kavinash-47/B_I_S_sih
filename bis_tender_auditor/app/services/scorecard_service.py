"""
Scorecard -- explicitly called "Specification Analysis Coverage", never a
legal compliance score, per the project's own instruction.
"""

def build_scorecard(requirements: list, recommendations: list, completeness: dict,
                     contradictions: list, brand_findings: list, version_issues: int,
                     qco_flags: int) -> dict:
    total_reqs = len(requirements)
    missing = completeness.get("missing_required_count", 0) if completeness else 0
    covered = max(total_reqs - missing, 0)
    current_std_count = sum(1 for r in recommendations if r.get("status") == "in_force")
    superseded_count = sum(1 for r in recommendations if r.get("status") in ("withdrawn", "superseded"))

    coverage_pct = round((covered / total_reqs) * 100, 1) if total_reqs else 0.0

    return {
        "label": "Specification Analysis Coverage",
        "disclaimer": "This is NOT a legal compliance score.",
        "requirements_identified": total_reqs,
        "requirements_covered": covered,
        "missing_required": missing,
        "current_standards_recommended": current_std_count,
        "superseded_standards_recommended": superseded_count,
        "qco_review_flags": qco_flags,
        "contradictions_found": len(contradictions),
        "brand_flags": len(brand_findings),
        "version_issues": version_issues,
        "overall_coverage_percent": coverage_pct,
    }
