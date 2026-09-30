# Feature Verification Matrix

"Tested" here means: I ran it against the running server or the pytest suite in
this environment and saw the actual output shown in TEST_REPORT.md. Nothing here
is marked tested on the strength of the code merely looking correct.

| # | Feature | Implemented | Tested | Test Result |
|---|---|---|---|---|
| 1 | Tender Analyzer (PDF/TXT/text extraction) | Yes | Yes | 4 pytest cases pass; corrupted/empty PDF correctly raise, not crash |
| 2 | Standard Recommender (BM25 + semantic hybrid) | Yes | Yes | Live queries return ranked, confidence-scored results; confirmed via curl and evaluation script |
| 3 | Evidence | Yes | Partially | `get_evidence()` returns correct fields for known standards; not covered by an automated test yet — only manual curl checks |
| 4 | Why Not | Yes | Partially | Returns plausible reasons in the /analyze pipeline; not unit-tested in isolation |
| 5 | Missing Standard Detector | Yes | Yes | 3 pytest cases pass, including the bug found and fixed (see TEST_REPORT.md) |
| 6 | Status (current/superseded badge) | Yes | Yes | Covered by version-checker tests; confirmed IS 8112 -> withdrawn, IS 269 -> in_force |
| 7 | QCO Checker | Yes | Yes | 4 pytest cases pass, including date-aware "not yet effective" logic |
| 8 | Clause Generator | Yes | Yes | 4 pytest cases pass; confirmed withdrawn-standard warning appears in drafted text |
| 9 | Verification (accept/reject/modify/note) | Yes | Yes | Tested live via curl: 2 actions logged and retrieved correctly |
| 10 | Audit Log + Hash Chain | Yes | Yes | 5 pytest cases pass, including a deliberate tamper test that correctly fails validation |
| 11 | Version / Merger Checker | Yes | Yes | 5 pytest cases pass, including the year-suffix (`IS 8112:2013`) parsing fix |
| 12 | Standards Bundle (edges table + endpoint) | Yes | Yes | `GET /api/standards/{is_number}/bundle` confirmed live: IS 1786 correctly returns its linked IS 1608 test-method standard; a standard with no links correctly returns an empty list with a clear message |
| 13 | Contradiction + Unit Checker | Yes | Yes | 5 pytest cases pass, using real `pint` unit conversion (not string comparison) |
| 14 | Brand Neutrality Checker | Yes | Yes | 5 pytest cases pass, including the word-boundary bug fix |
| 15 | Scorecard | Yes | Partially | Returns correct structure and math in live /analyze calls; no isolated pytest file yet |
| 16 | PDF Export | Yes | Yes | Confirmed a real PDF file is written to disk via curl test |
| 17 | Before/After Export (original vs officer-reviewed spec) | Yes | Yes | `POST /api/export/before-after` confirmed live: generates a PDF with original text, revised text, and a line-level unified diff; empty input correctly rejected with 400 |
| 18 | Evaluation Framework | Yes | Yes | Ran against the 5 real labelled queries; correctly reports the sample is too small for a reliable metric |

**18 of 18 features implemented; 15 of those tested with an automated or live-request
check; 3 (Evidence, Why-Not, Scorecard) exercised only through the full pipeline,
not in isolation with their own pytest file — see Known Limitations.**
