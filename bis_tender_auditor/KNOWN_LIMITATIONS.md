# Known Limitations — stated plainly, not buried

## Data
- **14 standards total.** Every feature works correctly, but the system can only
  ever recognize these 14 (plus the 2 withdrawn parents). This is a coverage
  limit of the dataset, not a bug in the code.
- **Most standards marked `secondary`**, not `official` — their source was a
  non-BIS mirror (law.resource.org, archive.org, a certification consultancy),
  not the BIS portal itself. Treat these as needing confirmation.
- **Three unresolved factual conflicts** are recorded in `data/qco_events.csv`
  with explicit notes: steel QCO enforcement status, furniture QCO effective
  date (two sources differ by a full year), and packaged-water order dates
  (three different dates found across sources). The system does not silently
  pick one — it surfaces the conflict in the `notes` field every time.
- **IS 1608 and IS 4609** are referenced as test-method standards in
  `standard_edges.csv` but were never added to `standards.csv` themselves.
  The recommender correctly reports "no match" for direct searches on them.

## Search / Recommendation
- The semantic layer is **TF-IDF, not a transformer embedding model** (see
  README for why, and how to swap in BGE-M3). It captures word-weighting
  beyond exact BM25 matching, but it is not true semantic understanding —
  it will not, for example, recognize a paraphrase with completely different
  vocabulary from the standard's title.
- **Not tested on Hindi/Telugu text.** The requirement extractor's regex
  patterns are English-oriented; Data 7's Hindi/Telugu tender lines and
  Data 8's non-English test queries were not run through the extractor in
  this session. The `test_queries.csv` used for evaluation transliterates
  the Hindi query into Latin script as a stand-in — this is a workaround,
  not a real multilingual capability.

## Evaluation
- **5 labelled queries, not 30-50.** Recall@1/@5/MRR were computed honestly
  from what exists (0.60 on all three), but this sample is far too small to
  be a reliable accuracy claim. Treat it as confirmation the pipeline runs
  end-to-end, not as a system accuracy figure.
- **No labelled tender documents** (full multi-requirement tenders with a
  ground-truth answer key) exist yet — only single-sentence queries. The
  "missing-standard detection metrics" and "requirement extraction
  precision/recall" the original spec asked for cannot be computed without
  such a dataset. The evaluation script is structured so adding one later
  (same CSV format) works without code changes.

## Features tested only through the full pipeline, not in isolation
- **Evidence** (`get_evidence`) and **Why-Not** (`why_not`): correct output
  confirmed via the `/api/tenders/analyze` endpoint and direct curl calls to
  `/api/recommendations/{is}/evidence`, but no dedicated `test_evidence.py`
  file exists yet.
- **Scorecard**: correct math confirmed in live `/analyze` responses; no
  isolated unit test file yet.

## Missing-standard / checklist matching
- Checklist matching is **keyword-in-text matching**, not true requirement
  understanding. It will miss a requirement phrased in an unexpected way
  even if the tender genuinely covers it. This is documented behavior, not
  a hidden gap — see the docstring in `app/services/missing_standard.py`.

## Not implemented
- **Nothing from the 18-feature list is unimplemented as of this delivery.**
  (An earlier draft of this file listed Standards Bundle and Before/After
  Export as missing; both were built and tested in this session — see
  FEATURE_MATRIX.md.)
- **SQLAlchemy** was not used (see README's "Why plain sqlite3" section) —
  a deliberate simplification for a team new to coding, not an oversight.
- **PostgreSQL migration path**: the schema is portable (plain SQL, no
  SQLite-specific syntax beyond `AUTOINCREMENT`), but no actual PostgreSQL
  connection code or migration script exists yet.
