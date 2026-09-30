"""
PDF/TXT text extraction. Uses PyMuPDF (fitz) if available; falls back to
a clear error rather than crashing the whole app if it isn't installed
or the file is corrupted/empty.
"""


class PDFParseError(Exception):
    pass


def extract_text_from_pdf(file_path: str) -> str:
    try:
        import fitz  # PyMuPDF
    except ImportError as e:
        raise PDFParseError(f"PyMuPDF not installed: {e}")

    try:
        doc = fitz.open(file_path)
    except Exception as e:
        raise PDFParseError(f"Could not open PDF (corrupted or not a PDF): {e}")

    if doc.page_count == 0:
        doc.close()
        raise PDFParseError("PDF has zero pages (empty PDF).")

    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    doc.close()

    full_text = "\n".join(text_parts).strip()
    if not full_text:
        raise PDFParseError("PDF contains no extractable text (may be scanned images only).")
    return full_text


def extract_text_from_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read().strip()
    if not text:
        raise PDFParseError("Text file is empty.")
    return text
