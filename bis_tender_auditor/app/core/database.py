"""
SQLite connection + schema. Kept deliberately as plain sqlite3 (not an ORM)
so the whole thing runs with zero extra dependencies and a beginner can
read every query directly.
"""
import sqlite3
from contextlib import contextmanager
from app.core.config import DB_PATH


SCHEMA = """
CREATE TABLE IF NOT EXISTS standards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_number TEXT NOT NULL,
    part TEXT,
    title TEXT NOT NULL,
    year INTEGER,
    status TEXT NOT NULL CHECK(status IN ('in_force','withdrawn','superseded','to_verify')),
    superseded_by TEXT,
    family TEXT,
    scope_summary TEXT,
    source_url TEXT,
    retrieved_on TEXT,
    verification TEXT NOT NULL CHECK(verification IN ('official','secondary','inferred','unverified','proposed')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(is_number, part, year)
);

CREATE TABLE IF NOT EXISTS standard_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    old_is_number TEXT NOT NULL,
    old_year TEXT,
    new_is_number TEXT NOT NULL,
    new_year TEXT,
    relationship_type TEXT NOT NULL,
    effective_date TEXT,
    date_reliability TEXT,
    source_url TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS qco_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qco_name TEXT NOT NULL,
    product_category TEXT,
    is_number TEXT,
    event_type TEXT NOT NULL,
    event_date TEXT,
    effective_date TEXT,
    withdrawal_date TEXT,
    source_url TEXT,
    verification TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS standard_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_is_number TEXT NOT NULL,
    target_is_number TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    description TEXT,
    source_url TEXT,
    verification TEXT
);

CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_name TEXT NOT NULL,
    product_family TEXT,
    wording_pattern TEXT
);

CREATE TABLE IF NOT EXISTS tenders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_text TEXT NOT NULL,
    filename TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tender_id INTEGER NOT NULL REFERENCES tenders(id),
    req_type TEXT NOT NULL,
    value TEXT,
    unit TEXT,
    source_text TEXT,
    char_start INTEGER,
    char_end INTEGER
);

CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tender_id INTEGER NOT NULL REFERENCES tenders(id),
    is_number TEXT NOT NULL,
    confidence REAL NOT NULL,
    bm25_score REAL,
    semantic_score REAL,
    matched_requirement TEXT,
    evidence_text TEXT,
    reason TEXT,
    status TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tender_id INTEGER,
    record_id TEXT,
    action TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    reason TEXT,
    officer TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    prev_hash TEXT,
    this_hash TEXT NOT NULL
);
"""


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_session():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with db_session() as conn:
        conn.executescript(SCHEMA)
