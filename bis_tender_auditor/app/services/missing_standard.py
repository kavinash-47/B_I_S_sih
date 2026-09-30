"""
Missing Standard / Completeness Detector.
Compares extracted requirements to the checklist for a product family and
to whether any recommended standard covers them. Does not assume every
requirement needs a BIS standard -- only flags what the checklist names.
"""
import os
import yaml
from app.core.config import CHECKLIST_DIR

_FAMILY_TO_FILE = {
    "PVC cables": "cable.yaml",
    "Cement": "cement.yaml",
    "LED street lights": "led_lighting.yaml",
    "Safety helmets": "safety_helmet.yaml",
    "uPVC water pipes": "upvc_pipe.yaml",
}


def _load_checklist(family: str):
    fname = _FAMILY_TO_FILE.get(family)
    if not fname:
        return None
    path = os.path.join(CHECKLIST_DIR, fname)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def check_completeness(family: str, extracted_requirements: list) -> dict:
    checklist = _load_checklist(family)
    if not checklist:
        return {"family": family, "checklist_found": False,
                "message": "No checklist defined for this product family yet."}

    extracted_types = {r["req_type"] for r in extracted_requirements}
    # crude keyword overlap between checklist item names and extracted req types/values
    extracted_blob = " ".join(
        f"{r.get('req_type','')} {r.get('value','')} {r.get('unit','')} {r.get('source_text','')}".lower()
        for r in extracted_requirements
    )

    report = []
    for item in checklist.get("requirements", []):
        name = item["name"]
        keyword = name.replace("_", " ")
        covered = keyword in extracted_blob
        report.append({
            "requirement": name,
            "required": item.get("required", False),
            "hint": item.get("hint"),
            "coverage": "found" if covered else "no matching requirement found",
            "status": "OK" if covered else ("MISSING" if item.get("required") else "OPTIONAL_MISSING"),
            "action": "Manual review required" if (not covered and item.get("required")) else "None",
        })

    missing_count = sum(1 for r in report if r["status"] == "MISSING")
    return {
        "family": family,
        "checklist_found": True,
        "checklist_note": checklist.get("description"),
        "items": report,
        "missing_required_count": missing_count,
        "total_required": sum(1 for i in checklist.get("requirements", []) if i.get("required")),
    }
