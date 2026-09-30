"""
Semantic retrieval layer.

Configurable via EMBEDDING_MODEL in app/core/config.py:
  - "TFIDF_FALLBACK" (default): scikit-learn TF-IDF + cosine similarity.
    Pure CPU, no download, no internet needed. This is a real, working
    semantic-ish layer (it captures word overlap/weighting beyond exact
    BM25 term matching) -- it is NOT a transformer embedding model, and
    is clearly reported as such in every response.
  - any sentence-transformers model name (e.g. "BAAI/bge-m3"): if the
    `sentence-transformers` package is installed AND the model can be
    loaded (internet/cache available), it is used instead. If loading
    fails for any reason, the system automatically falls back to
    TF-IDF and reports engine="tfidf_fallback" rather than crashing.
"""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.core.database import db_session
from app.core.config import EMBEDDING_MODEL

_model_cache = {"engine": None, "model": None}


def _get_engine():
    if _model_cache["engine"] is not None:
        return _model_cache["engine"]

    if EMBEDDING_MODEL != "TFIDF_FALLBACK":
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer(EMBEDDING_MODEL)
            _model_cache["engine"] = "sentence_transformers"
            _model_cache["model"] = model
            return "sentence_transformers"
        except Exception as e:
            print(f"[semantic_search] Could not load '{EMBEDDING_MODEL}' "
                  f"({e}). Falling back to TF-IDF.")

    _model_cache["engine"] = "tfidf_fallback"
    return "tfidf_fallback"


def _load_corpus():
    with db_session() as conn:
        rows = conn.execute(
            "SELECT is_number, part, title, year, scope_summary, family, status, "
            "superseded_by, source_url, verification "
            "FROM standards"
        ).fetchall()
    texts, meta = [], []
    for r in rows:
        texts.append(" ".join(filter(None, [r["is_number"], r["part"], r["title"], r["scope_summary"], r["family"]])))
        meta.append(dict(r))
    return texts, meta


def semantic_search(query: str, top_k: int = 5) -> list:
    """
    Returns list of {..., semantic_score, engine} sorted descending.
    engine is always reported so the caller/UI can show which method
    actually ran (TF-IDF fallback vs a real embedding model).
    """
    texts, meta = _load_corpus()
    if not texts or not query.strip():
        return []

    engine = _get_engine()

    if engine == "sentence_transformers":
        import numpy as np
        model = _model_cache["model"]
        doc_vecs = model.encode(texts)
        q_vec = model.encode([query])
        sims = cosine_similarity(q_vec, doc_vecs)[0]
    else:
        vectorizer = TfidfVectorizer(stop_words="english")
        try:
            doc_matrix = vectorizer.fit_transform(texts + [query])
        except ValueError:
            return []
        sims = cosine_similarity(doc_matrix[-1], doc_matrix[:-1])[0]

    ranked = sorted(zip(meta, sims), key=lambda x: x[1], reverse=True)[:top_k]
    return [
        {**m, "semantic_score": round(float(s), 4), "engine": engine}
        for m, s in ranked if s > 0
    ]
