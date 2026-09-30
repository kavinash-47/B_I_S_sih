"""
Shared test fixtures. Uses a SEPARATE temporary database so tests never
touch or corrupt bis_auditor.db (the real data).
"""
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pytest

TEST_DB = os.path.join(tempfile.gettempdir(), "test_bis_auditor.db")
os.environ["BIS_TEST_DB"] = TEST_DB

# Patch config BEFORE importing anything that reads it at import time
import app.core.config as config
config.DB_PATH = TEST_DB

from app.core.database import init_db, db_session


@pytest.fixture(scope="session", autouse=True)
def _setup_test_db():
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    init_db()
    with db_session() as conn:
        conn.execute("""INSERT INTO standards
            (is_number, part, title, year, status, superseded_by, family, scope_summary,
             source_url, retrieved_on, verification)
            VALUES ('IS 269', NULL, 'Ordinary portland cement - Specification', 2015,
                    'in_force', NULL, 'Cement', 'Cement specification.',
                    'https://bis.gov.in/is-269-2015/', '2026-09-28', 'official')""")
        conn.execute("""INSERT INTO standards
            (is_number, part, title, year, status, superseded_by, family, scope_summary,
             source_url, retrieved_on, verification)
            VALUES ('IS 8112', NULL, 'Ordinary Portland Cement 43 Grade', 2013,
                    'withdrawn', 'IS 269:2015', 'Cement', 'Withdrawn cement standard.',
                    'https://www.bis.gov.in/know-your-standard/', '2026-09-29', 'official')""")
        conn.execute("""INSERT INTO standard_versions
            (old_is_number, old_year, new_is_number, new_year, relationship_type,
             effective_date, date_reliability, source_url, notes)
            VALUES ('IS 8112', '2013', 'IS 269', '2015', 'merged_into', NULL, 'unknown',
                    'https://bis.gov.in/', 'test fixture')""")
        conn.execute("""INSERT INTO qco_events
            (qco_name, product_category, is_number, event_type, event_date,
             effective_date, withdrawal_date, source_url, verification, notes)
            VALUES ('Test Furniture QCO', 'Office Furniture', 'IS 17631', 'issued',
                    '2025-02-13', '2025-02-13', NULL, 'https://bis.gov.in/', 'secondary',
                    'test fixture')""")
        conn.execute("""INSERT INTO brands (brand_name, product_family, wording_pattern)
                        VALUES ('Polycab', 'PVC cables', 'Make: Polycab or equivalent')""")
    yield
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
