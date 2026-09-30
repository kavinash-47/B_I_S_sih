"""
Central configuration. Everything that might change between environments
lives here so no other module hardcodes a path or a magic number.
"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DB_PATH = os.path.join(BASE_DIR, "bis_auditor.db")
DATA_DIR = os.path.join(BASE_DIR, "data")
CHECKLIST_DIR = os.path.join(BASE_DIR, "checklists")

STANDARDS_CSV = os.path.join(DATA_DIR, "standards.csv")
VERSIONS_CSV = os.path.join(DATA_DIR, "standard_versions.csv")
QCO_CSV = os.path.join(DATA_DIR, "qco_events.csv")
EDGES_CSV = os.path.join(DATA_DIR, "standard_edges.csv")
BRANDS_CSV = os.path.join(DATA_DIR, "brands.csv")

# Recommender settings
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.15"))
BM25_WEIGHT = float(os.environ.get("BM25_WEIGHT", "0.5"))
SEMANTIC_WEIGHT = float(os.environ.get("SEMANTIC_WEIGHT", "0.5"))

# Embedding model is configurable so BGE-M3 (or anything else) can be
# swapped in later without touching calling code. If the named model
# cannot be loaded (no internet, not installed, etc.) the system falls
# back to a local TF-IDF semantic layer automatically -- see
# app/services/semantic_search.py.
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "TFIDF_FALLBACK")

DISCLAIMER = (
    "AI-assisted recommendation. This is advisory only and is NOT a legal "
    "compliance determination. Verify every standard, QCO status, and clause "
    "against the official BIS source before final procurement approval."
)
