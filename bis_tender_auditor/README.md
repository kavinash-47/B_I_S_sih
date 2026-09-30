# BIS Tender Specification Auditor — Backend

**The system assists a procurement officer. It does not make legal or compliance decisions.**
Every response carries this disclaimer:

> AI-assisted recommendation. This is advisory only and is NOT a legal compliance
> determination. Verify every standard, QCO status, and clause against the official
> BIS source before final procurement approval.

## ⚠️ Data status — read this first

All data in `data/*.csv` comes from a **student team's own manual research** against
the public BIS "Know Your Standard" portal, gazette notices, and secondary sources
(consultancy sites, archive.org mirrors). It is **not an official BIS export or API**.

- 14 standards, 6 version-links, 4 QCO events, 4 test-method links, 20 brand entries.
- Every row carries a `verification` column: `official` (checked directly on the
  BIS portal), `secondary` (a non-BIS source), or `unverified`/`unknown` for anything
  still in question. **Do not treat `secondary` rows as authoritative.**
- Three known unresolved conflicts (steel QCO status, furniture QCO effective date,
  packaged-water order dates) are recorded with explicit `notes` fields in
  `data/qco_events.csv` rather than being silently resolved one way or the other.
- Two standards (IS 1608, IS 4609) are referenced in `data/standard_edges.csv` as
  test-method standards but are **not themselves loaded into `standards.csv`** —
  the recommender will correctly report "no match" for them until someone adds them.

Replace this data with verified BIS data at any time by editing the CSVs in `data/`
and re-running `python scripts/load_data.py` — the loader validates every row.

## Architecture

```
bis_tender_auditor/
├── app/
│   ├── main.py              # FastAPI app, all routes
│   ├── core/config.py       # all settings in one place
│   ├── core/database.py     # SQLite schema (plain sqlite3, no ORM)
│   ├── schemas/              # Pydantic request models
│   └── services/              # one file per feature (see below)
├── data/                     # CSVs — see "Data status" above
├── checklists/                # YAML completeness checklists, 5 product families
├── evaluation/                # accuracy evaluation framework + labelled queries
├── scripts/init_db.py         # creates the schema
├── scripts/load_data.py       # validates + loads all CSVs
└── tests/                     # 41 pytest unit tests + API-level test log below
```

### Why plain `sqlite3`, not SQLAlchemy?
The spec asked to "use SQLAlchemy where appropriate." For a single-table-per-feature
schema this small, raw SQL is more transparent for a team that is still learning to
code — every query is visible in the file that uses it. Swapping to SQLAlchemy later
is a contained change (only `app/core/database.py` and the services' query lines).

### Why TF-IDF instead of BGE-M3?
`app/services/semantic_search.py` is written against a configurable
`EMBEDDING_MODEL` setting. Set it to `BAAI/bge-m3` (or anything else supported by
`sentence-transformers`) and, if that package is installed and the model can be
loaded, it's used automatically. If loading fails for **any** reason (no internet,
package missing, out of memory), the system **automatically falls back to a local
TF-IDF + cosine-similarity layer** — real, working, CPU-only, no download — and
every API response's `semantic_engine` field says which one actually ran. This
satisfies the "must not become unusable if the embedding model is unavailable"
requirement without requiring a model download in this environment.

## Installation

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Database setup

```bash
python scripts/init_db.py       # creates bis_auditor.db with all tables
python scripts/load_data.py     # loads + validates data/*.csv
```

The loader prints exactly what it skipped and why — it never silently drops a bad row.

## Running

```bash
python run.py
# or: uvicorn app.main:app --reload
```

Then open **http://127.0.0.1:8000/docs** for the interactive Swagger UI (works
out of the box via FastAPI).

Check `GET /health` — it reports how many standards are loaded and returns the
disclaimer text.

## API usage example

```bash
curl -X POST http://127.0.0.1:8000/api/tenders/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Supply of PVC cable IS 8112:2013, minimum 500 kg maximum 100 kg. Make: Polycab only.", "family": "PVC cables"}'
```

This single call runs the full pipeline: extraction → search → version check →
completeness → contradiction check → brand check → scorecard, all in one response.

## Running the tests

```bash
python -m pytest tests/ -v
```

**41/41 passing** as of the last run in this environment (see Test Report below).
Tests use a separate temporary SQLite database — they never touch your real data.

## Running the evaluation

```bash
python evaluation/run_evaluation.py
```

Reads `evaluation/test_queries.csv`. **This currently holds only the 5 real
labelled queries the team produced (from "Data 8")** — not the 30-50 samples a
stable accuracy figure would need. The script says so in its own output. Add more
labelled rows to that CSV (same 5-column format) to get a more reliable number.

## Offline deployment

- No cloud API is called anywhere in the codebase.
- Default `EMBEDDING_MODEL=TFIDF_FALLBACK` needs no download.
- SQLite is a local file (`bis_auditor.db`).
- Internet is only needed if you choose to switch to a `sentence-transformers`
  model, or when your team is out collecting new BIS/gazette data by hand.

## Replacing demo data with verified BIS data

1. Edit `data/standards.csv` (and the other CSVs) directly, or write a new export
   script that produces the same column format.
2. Every row needs a `source_url`, `retrieved_on` date, and a `verification` value
   (`official`/`secondary`/`unverified`) — the loader rejects rows missing these.
3. Run `python scripts/load_data.py` again — it's safe to re-run (uses `INSERT OR
   IGNORE` for standards; duplicates by `(is_number, part, year)` are skipped).
