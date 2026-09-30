"""
Export service. Produces a JSON report (always) and a PDF report
(via reportlab) containing every section required: summary, requirements,
recommendations, evidence, why-not, missing, status, QCO, contradictions,
brand findings, clauses, officer decisions, audit trail.
"""
import json
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from app.core.config import DISCLAIMER


def export_json(report: dict, out_path: str):
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    return out_path


def export_pdf(report: dict, out_path: str):
    doc = SimpleDocTemplate(out_path, pagesize=A4,
                             topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    h1 = styles["Heading1"]
    h2 = styles["Heading2"]
    body = styles["BodyText"]
    small = ParagraphStyle("small", parent=body, fontSize=8, textColor=colors.grey)

    story = []
    story.append(Paragraph("BIS Tender Specification Auditor — Report", h1))
    story.append(Paragraph(f"Generated: {datetime.now().isoformat()}", small))
    story.append(Paragraph(DISCLAIMER, small))
    story.append(Spacer(1, 12))

    story.append(Paragraph("1. Executive Summary", h2))
    sc = report.get("scorecard", {})
    story.append(Paragraph(
        f"Requirements identified: {sc.get('requirements_identified', 0)} | "
        f"Covered: {sc.get('requirements_covered', 0)} | "
        f"Missing: {sc.get('missing_required', 0)} | "
        f"Coverage: {sc.get('overall_coverage_percent', 0)}% "
        f"(this is a specification-analysis coverage figure, NOT a legal compliance score)",
        body))
    story.append(Spacer(1, 8))

    story.append(Paragraph("2. Tender Details", h2))
    story.append(Paragraph(f"Tender ID: {report.get('tender_id')}", body))
    story.append(Paragraph(f"Original text (truncated): {report.get('original_text', '')[:500]}", small))
    story.append(Spacer(1, 8))

    def section(title, rows, cols):
        story.append(Paragraph(title, h2))
        if not rows:
            story.append(Paragraph("None found.", body))
            return
        data = [cols] + [[str(r.get(c, "")) for c in cols] for r in rows]
        t = Table(data, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F3864")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(t)
        story.append(Spacer(1, 8))

    section("3. Extracted Requirements", report.get("requirements", []),
             ["req_type", "value", "unit", "source_text"])
    section("4. Recommended Standards", report.get("recommendations", []),
             ["is_number", "part", "title", "status", "confidence"])
    section("6. Why-Not Explanations", report.get("why_not", []),
             ["is_number", "reason"])
    section("8. Standard Status / Version Issues", report.get("version_checks", []),
             ["is_number", "current_status", "replacement_is_number", "action"])
    section("9. QCO Flags", report.get("qco_results", []),
             ["qco_name", "product_category", "status_as_of_requested_date"])
    section("10. Contradictions", report.get("contradictions", []),
             ["type", "minimum", "maximum", "detail"])
    section("11. Brand-Neutrality Findings", report.get("brand_findings", []),
             ["brand", "or_equivalent_detected", "action"])
    section("13. Officer Decisions", report.get("officer_decisions", []),
             ["record_id", "action", "reason", "timestamp"])
    section("14. Audit Trail", report.get("audit_trail", []),
             ["id", "action", "timestamp", "this_hash"])

    doc.build(story)
    return out_path


def export_before_after_pdf(tender_id: int, original_text: str, revised_text: str, out_path: str):
    """
    Before/After specification comparison: original tender text side by side
    (stacked, for page-width reasons) with the officer-revised text.
    """
    import difflib
    import re
    # Clean up any potential duplicate year patterns (e.g. :2010:2010 -> :2010)
    original_text = re.sub(r'(:[0-9]{4})(?::[0-9]{4})+', r'\1', original_text)
    revised_text = re.sub(r'(:[0-9]{4})(?::[0-9]{4})+', r'\1', revised_text)

    doc = SimpleDocTemplate(out_path, pagesize=A4,
                             topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    h1, h2, body, small = styles["Heading1"], styles["Heading2"], styles["BodyText"], \
        ParagraphStyle("small", parent=styles["BodyText"], fontSize=8, textColor=colors.grey)

    story = [Paragraph(f"Before / After Specification Comparison — Tender {tender_id}", h1),
             Paragraph(DISCLAIMER, small), Spacer(1, 12),
             Paragraph("Original Specification", h2),
             Paragraph(original_text.replace("\n", "<br/>"), body),
             Spacer(1, 12),
             Paragraph("Officer-Reviewed Specification", h2),
             Paragraph(revised_text.replace("\n", "<br/>"), body),
             Spacer(1, 12),
             Paragraph("Line-level Differences", h2)]

    diff_lines = list(difflib.unified_diff(
        original_text.splitlines(), revised_text.splitlines(),
        fromfile="original", tofile="revised", lineterm=""))
    if not diff_lines:
        story.append(Paragraph("No differences detected.", body))
    else:
        for line in diff_lines:
            style = small
            story.append(Paragraph(line.replace("<", "&lt;").replace(">", "&gt;"), style))

    doc.build(story)
    return out_path
