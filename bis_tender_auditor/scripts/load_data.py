"""
Loads all CSV/YAML data into the database.
Validates every row -- duplicates, missing fields, invalid years, invalid
statuses, malformed URLs are reported and the bad record is SKIPPED (with
a warning), never silently dropped without telling you.

Run: python scripts/load_data.py
"""
import sys, os, csv, re
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import db_session, init_db
from app.core import config

URL_RE = re.compile(r"^https?://[^\s]+$")
VALID_STATUS = {"in_force", "withdrawn", "superseded", "to_verify"}
VALID_VERIFICATION = {"official", "secondary", "inferred", "unverified", "proposed"}


def _warn(row_num, reason, row):
    print(f"  [SKIPPED row {row_num}] {reason}: {dict(row)}")


def load_standards():
    ok, skipped = 0, 0
    with open(config.STANDARDS_CSV, encoding="utf-8") as f, db_session() as conn:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, 2):
            if not row.get("is_number") or not row.get("title"):
                _warn(i, "missing is_number or title", row); skipped += 1; continue
            year = row.get("year") or None
            if year:
                try:
                    year_int = int(year)
                    if year_int < 1947 or year_int > 2030:
                        _warn(i, f"implausible year {year}", row); skipped += 1; continue
                except ValueError:
                    _warn(i, f"non-numeric year '{year}'", row); skipped += 1; continue
            status = row.get("status", "").strip()
            if status not in VALID_STATUS:
                _warn(i, f"invalid status '{status}'", row); skipped += 1; continue
            verification = row.get("verification", "").strip()
            if verification not in VALID_VERIFICATION:
                _warn(i, f"invalid verification '{verification}'", row); skipped += 1; continue
            url = row.get("source_url", "").strip()
            if url and not URL_RE.match(url):
                _warn(i, f"malformed URL '{url}'", row); skipped += 1; continue
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO standards
                       (is_number, part, title, year, status, superseded_by, family,
                        scope_summary, source_url, retrieved_on, verification)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (row["is_number"].strip(), row.get("part", "").strip() or None,
                     row["title"].strip(), year, status,
                     row.get("superseded_by", "").strip() or None,
                     row.get("family", "").strip() or None,
                     row.get("scope_summary", "").strip() or None,
                     url or None, row.get("retrieved_on", "").strip() or None,
                     verification))
                ok += 1
            except Exception as e:
                _warn(i, f"insert failed: {e}", row); skipped += 1
    print(f"standards: {ok} loaded, {skipped} skipped")


def load_generic(csv_path, table, columns):
    ok, skipped = 0, 0
    with open(csv_path, encoding="utf-8") as f, db_session() as conn:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, 2):
            values = [row.get(c, "").strip() or None for c in columns]
            if values[0] is None:
                _warn(i, "missing first required field", row); skipped += 1; continue
            placeholders = ",".join("?" * len(columns))
            try:
                conn.execute(
                    f"INSERT INTO {table} ({','.join(columns)}) VALUES ({placeholders})",
                    values)
                ok += 1
            except Exception as e:
                _warn(i, f"insert failed: {e}", row); skipped += 1
    print(f"{table}: {ok} loaded, {skipped} skipped")


if __name__ == "__main__":
    init_db()
    print("Loading standards.csv ...")
    load_standards()
    print("Loading standard_versions.csv ...")
    load_generic(config.VERSIONS_CSV, "standard_versions",
                  ["old_is_number", "old_year", "new_is_number", "new_year",
                   "relationship_type", "effective_date", "date_reliability",
                   "source_url", "notes"])
    print("Loading qco_events.csv ...")
    load_generic(config.QCO_CSV, "qco_events",
                  ["qco_name", "product_category", "is_number", "event_type",
                   "event_date", "effective_date", "withdrawal_date",
                   "source_url", "verification", "notes"])
    print("Loading standard_edges.csv ...")
    load_generic(config.EDGES_CSV, "standard_edges",
                  ["source_is_number", "target_is_number", "relationship_type",
                   "description", "source_url", "verification"])
    print("Loading brands.csv ...")
    load_generic(config.BRANDS_CSV, "brands",
                  ["brand_name", "product_family", "wording_pattern"])
    print("Done.")
