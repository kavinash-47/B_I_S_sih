"""
Keyword retrieval using BM25 (rank_bm25 library) over the standards table.
"""
from rank_bm25 import BM25Okapi
from app.core.database import db_session


def _tokenize(text: str) -> list:
    return text.lower().replace("/", " ").replace("-", " ").replace('"', " ").replace("'", " ").split()


def _load_corpus():
    with db_session() as conn:
        rows = conn.execute(
            "SELECT is_number, part, title, year, scope_summary, family, status, "
            "superseded_by, source_url, verification "
            "FROM standards"
        ).fetchall()
    docs, meta = [], []
    for r in rows:
        text = " ".join(filter(None, [r["is_number"], r["part"], r["title"], r["scope_summary"], r["family"]]))
        docs.append(_tokenize(text))
        meta.append(dict(r))
    return docs, meta


def bm25_search(query: str, top_k: int = 5) -> list:
    """
    Returns list of {is_number, part, title, status, superseded_by, family,
    scope_summary, bm25_score} sorted by score descending.
    Empty database or empty query returns [] rather than raising.
    """
    docs, meta = _load_corpus()
    if not docs or not query.strip():
        return []
    bm25 = BM25Okapi(docs)
    scores = bm25.get_scores(_tokenize(query))
    ranked = sorted(zip(meta, scores), key=lambda x: x[1], reverse=True)[:top_k]
    max_score = max((s for _, s in ranked), default=0) or 1
    return [
        {**m, "bm25_score": round(s, 4), "bm25_score_normalized": round(s / max_score, 4)}
        for m, s in ranked if s > 0
    ]
