"""
Accuracy evaluation framework.

IMPORTANT: this runs against evaluation/test_queries.csv, which currently
holds only the 5 real labelled queries the team produced (Data 8). It does
NOT contain 30-50 samples. This script says so in its own output rather
than pretending otherwise.

Metrics: Recall@1, Recall@5, MRR -- computed honestly from whatever is in
the CSV, however small.
"""
import sys, os, csv
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.hybrid_search import recommend_standards

QUERIES_CSV = os.path.join(os.path.dirname(__file__), "test_queries.csv")


def run():
    with open(QUERIES_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if len(rows) < 30:
        print(f"NOTE: only {len(rows)} labelled queries available "
              f"(evaluation framework expects 30-50 for a stable estimate). "
              f"Results below are indicative only, not a reliable accuracy figure.\n")

    hits_at_1, hits_at_5, reciprocal_ranks = 0, 0, []
    results_table = []

    for row in rows:
        rec = recommend_standards(row["query"], top_k=5)
        retrieved = [r["is_number"] for r in rec["results"]]
        expected = row["expected_is_number"]

        rank = None
        for i, is_num in enumerate(retrieved, 1):
            if is_num == expected:
                rank = i
                break

        if rank == 1:
            hits_at_1 += 1
        if rank is not None and rank <= 5:
            hits_at_5 += 1
        reciprocal_ranks.append(1 / rank if rank else 0)

        results_table.append({
            "query_id": row["query_id"], "expected": expected,
            "retrieved": retrieved, "rank": rank,
            "in_database": expected in _all_is_numbers(),
        })

    n = len(rows)
    recall_1 = hits_at_1 / n if n else 0
    recall_5 = hits_at_5 / n if n else 0
    mrr = sum(reciprocal_ranks) / n if n else 0

    print("=" * 60)
    print("EVALUATION RESULTS (from evaluation/test_queries.csv)")
    print("=" * 60)
    for r in results_table:
        note = "" if r["in_database"] else "  <-- expected standard is NOT in local standards.csv"
        print(f"{r['query_id']}: expected={r['expected']} rank={r['rank']} "
              f"retrieved_top5={r['retrieved']}{note}")
    print("-" * 60)
    print(f"Recall@1: {recall_1:.2f}")
    print(f"Recall@5: {recall_5:.2f}")
    print(f"MRR:      {mrr:.2f}")
    print(f"N = {n} labelled queries (NOT the 30-50 required for a stable metric)")
    print("=" * 60)
    return {"recall_at_1": recall_1, "recall_at_5": recall_5, "mrr": mrr, "n": n}


def _all_is_numbers():
    import sqlite3
    from app.core.config import DB_PATH
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT DISTINCT is_number FROM standards").fetchall()
    conn.close()
    return {r[0] for r in rows}


if __name__ == "__main__":
    run()
