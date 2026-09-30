"""
Combines BM25 + semantic search into one ranked, confidence-scored list.
If a candidate is superseded/withdrawn, it is demoted in the final ranking
but still shown (with a clear flag) rather than hidden -- an officer
should see that "the closest match is outdated" rather than nothing.
"""
from app.services.bm25_search import bm25_search
from app.services.semantic_search import semantic_search
from app.core.config import BM25_WEIGHT, SEMANTIC_WEIGHT, CONFIDENCE_THRESHOLD

NO_MATCH_MESSAGE = "No reliable match — review manually."


def recommend_standards(query: str, top_k: int = 5) -> dict:
    clean_query = (query or "").strip().strip('"\'“”‘’\\')
    bm25_results = {r["is_number"] + (r["part"] or ""): r for r in bm25_search(clean_query, top_k=10)}
    sem_results = {r["is_number"] + (r["part"] or ""): r for r in semantic_search(clean_query, top_k=10)}

    all_keys = set(bm25_results) | set(sem_results)
    combined = []
    engine_used = "tfidf_fallback"
    for key in all_keys:
        b = bm25_results.get(key)
        s = sem_results.get(key)
        base = b or s
        bm25_norm = b["bm25_score_normalized"] if b else 0.0
        sem_score = s["semantic_score"] if s else 0.0
        if s:
            engine_used = s["engine"]
        confidence = round(BM25_WEIGHT * bm25_norm + SEMANTIC_WEIGHT * sem_score, 4)

        penalty_reason = None
        if base["status"] in ("withdrawn", "superseded"):
            confidence = round(confidence * 0.5, 4)
            penalty_reason = (f"Standard is {base['status']}"
                               + (f"; superseded by {base['superseded_by']}" if base.get("superseded_by") else "")
                               + ". Confidence halved.")

        combined.append({
            "is_number": base["is_number"],
            "part": base["part"],
            "title": base["title"],
            "year": base.get("year"),
            "status": base["status"],
            "superseded_by": base.get("superseded_by"),
            "family": base.get("family"),
            "source_url": base.get("source_url"),
            "confidence": confidence,
            "bm25_score": bm25_norm,
            "semantic_score": sem_score,
            "semantic_engine": engine_used,
            "penalty_reason": penalty_reason,
        })

    combined.sort(key=lambda x: x["confidence"], reverse=True)
    top = [c for c in combined if c["confidence"] >= CONFIDENCE_THRESHOLD][:top_k]

    if not top:
        return {
            "query": clean_query,
            "results": [],
            "message": NO_MATCH_MESSAGE,
            "confidence_threshold": CONFIDENCE_THRESHOLD,
        }
    return {"query": clean_query, "results": top, "message": None,
            "confidence_threshold": CONFIDENCE_THRESHOLD}
