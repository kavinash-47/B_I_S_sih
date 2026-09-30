import os, tempfile
import pytest
from app.services.pdf_parser import extract_text_from_txt, extract_text_from_pdf, PDFParseError


def test_empty_txt_raises():
    path = os.path.join(tempfile.gettempdir(), "empty_test.txt")
    with open(path, "w") as f:
        f.write("")
    with pytest.raises(PDFParseError):
        extract_text_from_txt(path)
    os.remove(path)


def test_valid_txt_returns_text():
    path = os.path.join(tempfile.gettempdir(), "valid_test.txt")
    with open(path, "w") as f:
        f.write("Some tender text.")
    assert extract_text_from_txt(path) == "Some tender text."
    os.remove(path)


def test_corrupted_pdf_raises():
    path = os.path.join(tempfile.gettempdir(), "corrupt_test.pdf")
    with open(path, "wb") as f:
        f.write(b"NOT A REAL PDF FILE CONTENT")
    with pytest.raises(PDFParseError):
        extract_text_from_pdf(path)
    os.remove(path)


def test_nonexistent_file_raises():
    with pytest.raises(PDFParseError):
        extract_text_from_pdf("/tmp/does_not_exist_12345.pdf")
