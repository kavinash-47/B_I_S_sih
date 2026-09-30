"""
BIS Tender Specification Auditor -- FastAPI application.
Run: uvicorn app.main:app --reload
Docs: http://127.0.0.1:8000/docs
"""
import os
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import DISCLAIMER, DATA_DIR
from app.core.database import init_db, db_session
from app.schemas.tender import TenderTextIn, ClauseIn, VerificationIn, BeforeAfterIn

from app.services.pdf_parser import extract_text_from_pdf, extract_text_from_txt, PDFParseError
from app.services.requirement_extractor import extract_requirements, extract_cited_is_numbers
from app.services.hybrid_search import recommend_standards
from app.services.evidence_engine import get_evidence, why_not
from app.services.missing_standard import check_completeness
from app.services.version_checker import check_standard_version
from app.services.qco_checker import get_qco_status
from app.services.contradiction_checker import check_contradictions
from app.services.brand_checker import check_brand_neutrality
from app.services.clause_generator import generate_clause
from app.services.audit_service import log_action, get_audit_trail, verify_audit_chain
from app.services.scorecard_service import build_scorecard
from app.services.export_service import export_json, export_pdf, export_before_after_pdf
from app.services.bundle_service import get_related_standards

app = FastAPI(
    title="BIS Tender Specification Auditor",
    description=DISCLAIMER,
    version="0.1.0",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB


@app.on_event("startup")
def _startup():
    init_db()


@app.get("/health")
def health():
    try:
        with db_session() as conn:
            count = conn.execute("SELECT COUNT(*) c FROM standards").fetchone()["c"]
        return {"status": "ok", "standards_loaded": count, "disclaimer": DISCLAIMER}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}


def _safe_filename(name: str) -> str:
    base = os.path.basename(name or "upload")
    return "".join(c for c in base if c.isalnum() or c in "._-") or "upload"


# ---------- Tenders ----------
@app.post("/api/tenders/upload")
async def upload_tender(file: UploadFile = File(...)):
    filename = _safe_filename(file.filename)
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(400, "Uploaded file is empty.")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 15 MB).")

    suffix = ".pdf" if filename.lower().endswith(".pdf") else ".txt"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        if suffix == ".pdf":
            text = extract_text_from_pdf(tmp_path)
        else:
            text = extract_text_from_txt(tmp_path)
    except PDFParseError as e:
        raise HTTPException(422, str(e))
    finally:
        os.unlink(tmp_path)

    # If the uploaded file is a previously exported audit report, attempt to resolve the actual tender text
    if "BIS Tender Specification Auditor" in text or "Advisory Specification Coverage Report" in text:
        import re
        m = re.search(r"Tender ID:\s*#(\d+)", text)
        if m:
            ref_id = int(m.group(1))
            with db_session() as conn:
                ref_tender = conn.execute("SELECT * FROM tenders WHERE id = ?", (ref_id,)).fetchone()
                if ref_tender and ref_tender["original_text"] and not ref_tender["original_text"].startswith("BIS Tender Specification Auditor"):
                    text = ref_tender["original_text"]

    with db_session() as conn:
        cur = conn.execute(
            "INSERT INTO tenders (original_text, filename) VALUES (?, ?)",
            (text, filename))
        tender_id = cur.lastrowid

    return {"tender_id": tender_id, "filename": filename, "char_count": len(text), "text": text, "original_text": text}


@app.post("/api/tenders/analyze")
def analyze_tender(payload: TenderTextIn):
    if not payload.text or not payload.text.strip():
        raise HTTPException(400, "Tender text is empty.")

    with db_session() as conn:
        cur = conn.execute("INSERT INTO tenders (original_text) VALUES (?)", (payload.text,))
        tender_id = cur.lastrowid

    requirements = extract_requirements(payload.text)
    with db_session() as conn:
        for r in requirements:
            conn.execute(
                """INSERT INTO requirements (tender_id, req_type, value, unit, source_text,
                   char_start, char_end) VALUES (?,?,?,?,?,?,?)""",
                (tender_id, r["req_type"], str(r["value"]), r.get("unit"),
                 r["source_text"], r["char_start"], r["char_end"]))

    cited = extract_cited_is_numbers(payload.text)
    version_checks = [check_standard_version(c) for c in cited]

    # Build search queries: use full text plus each requirement's source_text
    queries = [payload.text] + [r["source_text"] for r in requirements if r["req_type"] in
                                 ("grade", "voltage", "dimension")]
    all_recs, seen = [], set()
    for q in queries:
        rec = recommend_standards(q, top_k=5)
        for r in rec["results"]:
            key = r["is_number"] + (r["part"] or "")
            if key not in seen:
                seen.add(key)
                all_recs.append(r)
    all_recs.sort(key=lambda x: x["confidence"], reverse=True)

    with db_session() as conn:
        for r in all_recs:
            conn.execute(
                """INSERT INTO recommendations (tender_id, is_number, confidence, bm25_score,
                   semantic_score, status) VALUES (?,?,?,?,?,?)""",
                (tender_id, r["is_number"], r["confidence"], r["bm25_score"],
                 r["semantic_score"], r["status"]))

    why_not_list = [{"is_number": r["is_number"], "reason": why_not(r, payload.text)}
                     for r in all_recs[3:8]]  # explain a few of the non-top picks

    completeness = check_completeness(payload.family, requirements) if payload.family else None
    contradictions = check_contradictions(payload.text)
    brand_findings = check_brand_neutrality(payload.text)

    version_issue_count = sum(1 for v in version_checks if v.get("found") and "replacement_is_number" in v)
    qco_flag_count = sum(1 for r in all_recs if r["is_number"])  # placeholder count; real check is per-standard via /qco endpoint

    scorecard = build_scorecard(requirements, all_recs, completeness or {}, contradictions,
                                 brand_findings, version_issue_count, qco_flag_count)

    log_action(tender_id, str(tender_id), "analyze", new_value="tender analyzed")

    return {
        "tender_id": tender_id,
        "original_text": payload.text,
        "requirements": requirements,
        "cited_is_numbers": cited,
        "version_checks": version_checks,
        "recommendations": all_recs if all_recs else [],
        "no_match_message": None if all_recs else "No reliable match — review manually.",
        "why_not": why_not_list,
        "completeness": completeness,
        "contradictions": contradictions,
        "brand_findings": brand_findings,
        "scorecard": scorecard,
        "disclaimer": DISCLAIMER,
    }


@app.get("/api/tenders/{tender_id}")
def get_tender(tender_id: int):
    with db_session() as conn:
        tender = conn.execute("SELECT * FROM tenders WHERE id = ?", (tender_id,)).fetchone()
    if not tender:
        raise HTTPException(404, "Tender not found.")
    return {
        "tender_id": tender["id"],
        "original_text": tender["original_text"],
        "filename": tender["filename"],
        "created_at": tender["created_at"],
    }


@app.get("/api/tenders/{tender_id}/missing")
def missing_for_tender(tender_id: int, family: str):
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM requirements WHERE tender_id = ?", (tender_id,)).fetchall()
    if not rows:
        raise HTTPException(404, "No requirements found for this tender_id.")
    reqs = [dict(r) for r in rows]
    return check_completeness(family, reqs)


@app.get("/api/tenders/{tender_id}/scorecard")
def scorecard_for_tender(tender_id: int):
    with db_session() as conn:
        reqs = [dict(r) for r in conn.execute(
            "SELECT * FROM requirements WHERE tender_id = ?", (tender_id,)).fetchall()]
        recs = [dict(r) for r in conn.execute(
            "SELECT * FROM recommendations WHERE tender_id = ?", (tender_id,)).fetchall()]
    if not reqs and not recs:
        raise HTTPException(404, "Tender not found or not yet analyzed.")
    return build_scorecard(reqs, recs, {}, [], [], 0, 0)


# ---------- Standards ----------
@app.get("/api/standards/search")
def search_standards(q: str, top_k: int = 5):
    return recommend_standards(q, top_k=top_k)


@app.get("/api/standards/{is_number}/status")
def standard_status(is_number: str):
    return check_standard_version(is_number)


@app.get("/api/standards/{is_number}/qco")
def standard_qco(is_number: str, on_date: str = None):
    return get_qco_status(is_number=is_number, on_date=on_date)


@app.get("/api/standards/{is_number}/bundle")
def standard_bundle(is_number: str):
    return get_related_standards(is_number)


# ---------- Recommendations ----------
@app.post("/api/recommendations")
def post_recommendation(payload: TenderTextIn):
    return recommend_standards(payload.text)


@app.get("/api/recommendations/{is_number}/evidence")
def recommendation_evidence(is_number: str, part: str = None):
    return get_evidence(is_number, part)


@app.get("/api/recommendations/{is_number}/why-not")
def recommendation_why_not(is_number: str, requirement_text: str = ""):
    ev = get_evidence(is_number)
    if not ev.get("found"):
        raise HTTPException(404, "Standard not found.")
    return {"is_number": is_number, "reason": why_not(ev, requirement_text)}


# ---------- Clauses ----------
@app.post("/api/clauses/generate")
def clauses_generate(payload: ClauseIn):
    result = generate_clause(payload.is_number, payload.part)
    if not result.get("found"):
        raise HTTPException(404, result.get("message"))
    return result


# ---------- Verification / Audit ----------
@app.post("/api/verification")
def post_verification(payload: VerificationIn):
    if payload.action not in ("accept", "reject", "modify", "note"):
        raise HTTPException(400, "action must be one of: accept, reject, modify, note")
    result = log_action(payload.tender_id, payload.record_id, payload.action,
                         payload.previous_value, payload.new_value,
                         payload.reason, payload.officer)
    return result


@app.get("/api/audit/{tender_id}")
def audit_for_tender(tender_id: int):
    trail = get_audit_trail(tender_id)
    validity = verify_audit_chain(tender_id)
    return {"tender_id": tender_id, "audit_trail": trail, "chain_valid": validity}


_exported_files = {}


# ---------- Export ----------
@app.post("/api/export/pdf")
def export_pdf_endpoint(tender_id: int):
    with db_session() as conn:
        tender = conn.execute("SELECT * FROM tenders WHERE id = ?", (tender_id,)).fetchone()
        if not tender:
            raise HTTPException(404, "Tender not found.")
        reqs = [dict(r) for r in conn.execute(
            "SELECT * FROM requirements WHERE tender_id = ?", (tender_id,)).fetchall()]
        recs = [dict(r) for r in conn.execute(
            "SELECT * FROM recommendations WHERE tender_id = ?", (tender_id,)).fetchall()]
    audit_trail = get_audit_trail(tender_id)
    scorecard = build_scorecard(reqs, recs, {}, [], [], 0, 0)

    report = {
        "tender_id": tender_id,
        "original_text": tender["original_text"],
        "requirements": reqs,
        "recommendations": recs,
        "scorecard": scorecard,
        "audit_trail": audit_trail,
    }
    out_dir = tempfile.mkdtemp()
    json_path = export_json(report, os.path.join(out_dir, f"tender_{tender_id}_report.json"))
    pdf_path = export_pdf(report, os.path.join(out_dir, f"tender_{tender_id}_report.pdf"))
    _exported_files[os.path.basename(pdf_path)] = pdf_path
    return {"json_report": json_path, "pdf_report": pdf_path}


@app.get("/api/export/download/{filename}")
def download_export_file(filename: str):
    safe_name = os.path.basename(filename)
    path = _exported_files.get(safe_name)
    if not path or not os.path.exists(path):
        temp_dir = tempfile.gettempdir()
        for root, _, files in os.walk(temp_dir):
            if safe_name in files:
                candidate = os.path.join(root, safe_name)
                if os.path.exists(candidate):
                    path = candidate
                    break
    if not path or not os.path.exists(path):
        raise HTTPException(404, f"Exported file '{safe_name}' not found.")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
    )


@app.post("/api/export/before-after")
def export_before_after(payload: BeforeAfterIn):
    if not payload.original_text.strip() or not payload.revised_text.strip():
        raise HTTPException(400, "Both original_text and revised_text are required.")

    import re
    orig_text = payload.original_text.strip()
    rev_text = payload.revised_text.strip()

    # Clean up duplicate years (e.g. :2010:2010 -> :2010)
    orig_text = re.sub(r'(:[0-9]{4})(?::[0-9]{4})+', r'\1', orig_text)
    rev_text = re.sub(r'(:[0-9]{4})(?::[0-9]{4})+', r'\1', rev_text)

    # Check if orig_text is an old report rather than the actual tender specification
    if "BIS Tender Specification Auditor" in orig_text or "Advisory Specification Coverage Report" in orig_text:
        with db_session() as conn:
            m = re.search(r"Tender ID:\s*#(\d+)", orig_text)
            ref_id = int(m.group(1)) if m else payload.tender_id
            ref_row = conn.execute("SELECT * FROM tenders WHERE id = ?", (ref_id,)).fetchone()
            if ref_row and ref_row["original_text"] and not ref_row["original_text"].startswith("BIS Tender Specification Auditor"):
                actual_orig = ref_row["original_text"].strip()
                # If rev_text also had report text, reconstruct rev_text by applying this tender's modifications onto actual_orig
                if "BIS Tender Specification Auditor" in rev_text:
                    audit_rows = conn.execute(
                        "SELECT previous_value, new_value, record_id FROM audit_log WHERE tender_id = ? AND action = 'modify'",
                        (payload.tender_id,)).fetchall()
                    actual_rev = actual_orig
                    for ar in audit_rows:
                        t = (ar["previous_value"] or ar["record_id"] or "").strip()
                        r = (ar["new_value"] or "").strip()
                        if t and r and t != r:
                            suffix = r[len(t):].strip() if r.startswith(t) else ""
                            if suffix:
                                actual_rev = re.sub(rf"{re.escape(t)}(?!\s*{re.escape(suffix)})", r, actual_rev)
                            else:
                                actual_rev = actual_rev.replace(t, r)
                    rev_text = actual_rev
                orig_text = actual_orig

    # Ensure no duplicate years in final output
    orig_text = re.sub(r'(:[0-9]{4})(?::[0-9]{4})+', r'\1', orig_text)
    rev_text = re.sub(r'(:[0-9]{4})(?::[0-9]{4})+', r'\1', rev_text)

    out_dir = tempfile.mkdtemp()
    pdf_path = export_before_after_pdf(
        payload.tender_id, orig_text, rev_text,
        os.path.join(out_dir, f"tender_{payload.tender_id}_before_after.pdf"))
    _exported_files[os.path.basename(pdf_path)] = pdf_path
    log_action(payload.tender_id, str(payload.tender_id), "export_before_after",
               previous_value=orig_text[:200], new_value=rev_text[:200])
    return {"pdf_report": pdf_path}
