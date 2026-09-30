import React, { useState } from "react";
import {
  Search,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  BookOpen,
  Tag,
  Layers,
  X,
  Sparkles
} from "lucide-react";

// Preset sample queries for quick exploration
const SEARCH_SAMPLES = [
  { label: "IS 694 (PVC Cables)", query: "IS 694" },
  { label: "IS 269 (Cement)", query: "IS 269" },
  { label: "PVC Cables", query: "PVC cables" },
  { label: "Cement", query: "Cement" },
  { label: "LED Street Lights", query: "LED street lights" },
  { label: "Safety Helmets", query: "Safety helmets" },
  { label: "uPVC Water Pipes", query: "IS 4985" },
];

// Clean stray quotes (leading/trailing or duplicated), smart quotes, and extra whitespace
const sanitizeSearchQuery = (str) => {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/^[\s"'“”‘’\\]+/, "") // strip leading quotes, backslashes, whitespace
    .replace(/[\s"'“”‘’\\]+$/, "") // strip trailing quotes, backslashes, whitespace
    .trim();
};

export default function QuickStandardsSearch({ backendStatus = "online", initialQuery = "" }) {
  const [query, setQuery] = useState(() => sanitizeSearchQuery(initialQuery));
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);

  const executeSearch = async (searchQuery) => {
    const cleaned = sanitizeSearchQuery(searchQuery);
    if (!cleaned) {
      setError("Please enter an IS number, product name, or keyword to search.");
      setResults(null);
      return;
    }

    setIsLoading(true);
    setError("");
    setQuery(cleaned);
    setLastSearchedQuery(cleaned);

    try {
      let response;
      try {
        response = await fetch(
          `http://127.0.0.1:8000/api/standards/search?q=${encodeURIComponent(cleaned)}&top_k=20`
        );
      } catch {
        response = await fetch(
          `http://localhost:8000/api/standards/search?q=${encodeURIComponent(cleaned)}&top_k=20`
        );
      }

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error("Standard search error:", err);
      setError(
        backendStatus === "offline"
          ? "Backend API is currently offline. Please ensure the backend server is running on 127.0.0.1:8000."
          : `Failed to search standards: ${err.message || "Unknown error"}`
      );
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    let val = e.target.value;
    // Strip stray leading quote character so the input box stays clean
    val = val.replace(/^[\s"'“”‘’\\]+/, "");
    setQuery(val);
    if (error) setError("");
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData?.getData("text") || "";
    const cleaned = sanitizeSearchQuery(pasted);
    setQuery(cleaned);
    if (error) setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleSampleClick = (sampleQuery) => {
    const cleaned = sanitizeSearchQuery(sampleQuery);
    setQuery(cleaned);
    executeSearch(cleaned);
  };

  const handleClear = () => {
    setQuery("");
    setResults(null);
    setError("");
    setLastSearchedQuery("");
  };

  const handleCopyStandard = (isNumber, key) => {
    navigator.clipboard.writeText(isNumber);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "in_force":
        return "In Force";
      case "withdrawn":
        return "Withdrawn";
      case "superseded":
        return "Superseded";
      case "to_verify":
        return "To Verify";
      default:
        return status ? status.replace("_", " ") : "Unknown";
    }
  };

  return (
    <div className="quick-search-page">
      {/* Search Header Card */}
      <div className="analyzer-card quick-search-card">
        <div className="quick-search-header">
          <div className="quick-search-icon-title">
            <div className="search-icon-badge">
              <Search size={22} />
            </div>
            <div>
              <h2 className="quick-search-title">Quick Standard Search</h2>
              <p className="quick-search-subtitle">
                Search the Bureau of Indian Standards (BIS) repository by standard number, title, or product keyword.
              </p>
            </div>
          </div>
        </div>

        {/* Search Input Form */}
        <form onSubmit={handleSubmit} className="quick-search-form">
          <div className="search-input-wrapper">
            <Search size={18} className="search-input-icon" />
            <input
              type="text"
              className="quick-search-input"
              value={query}
              onChange={handleInputChange}
              onPaste={handlePaste}
              onBlur={() => setQuery((prev) => sanitizeSearchQuery(prev))}
              placeholder="Search standard, e.g. IS 694, IS 269, cement, cables, safety helmets..."
              autoFocus
            />
            {query && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleClear}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="btn-submit quick-search-submit"
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span>Search</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="sample-bar quick-search-samples">
          <span className="sample-label">
            <Sparkles size={14} /> Quick Examples:
          </span>
          {SEARCH_SAMPLES.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              className="sample-chip"
              onClick={() => handleSampleClick(sample.query)}
              disabled={isLoading}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="error-title">Search Error</div>
            <div className="error-desc">{error}</div>
          </div>
        </div>
      )}

      {/* Results Container */}
      {results !== null && !isLoading && (
        <div className="analyzer-card search-results-card">
          <div className="search-results-meta">
            <div className="search-results-count">
              Found <strong>{results.length}</strong> {results.length === 1 ? "standard" : "standards"} for{" "}
              <strong>"{sanitizeSearchQuery(lastSearchedQuery)}"</strong>
            </div>
            {results.length > 0 && (
              <span className="search-results-hint">
                Click standard number or copy icon to copy IS code
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <div className="empty-state search-empty-state">
              <BookOpen size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <h4>No matching standards found</h4>
              <p>
                No exact or semantic matches found for <strong>"{sanitizeSearchQuery(lastSearchedQuery)}"</strong>.
              </p>
              <p className="empty-tip">
                Try searching with an Indian Standard number like <code>IS 694</code>, <code>IS 269</code>, or broader keywords like <code>cables</code>, <code>cement</code>, <code>lighting</code>.
              </p>
            </div>
          ) : (
            <div className="compact-standards-list">
              {results.map((std, idx) => {
                const uniqueKey = `${std.is_number}_${std.part || ""}_${idx}`;
                const isCopied = copiedKey === uniqueKey;

                return (
                  <div key={uniqueKey} className="compact-standard-item">
                    {/* Left: IS Number & Status */}
                    <div className="compact-item-left">
                      <div className="compact-is-badge">
                        <span className="compact-is-text">{std.is_number}</span>
                        {std.part && <span className="compact-part-text">{std.part}</span>}
                      </div>

                      <span className={`badge badge-${std.status}`}>
                        {getStatusLabel(std.status)}
                      </span>
                    </div>

                    {/* Center: Title & Metadata */}
                    <div className="compact-item-center">
                      <h4 className="compact-standard-title">{std.title}</h4>

                      <div className="compact-standard-meta">
                        {std.year && (
                          <span className="compact-meta-pill">
                            Year: <strong>{std.year}</strong>
                          </span>
                        )}

                        {std.family && (
                          <span className="compact-meta-pill">
                            <Tag size={12} /> {std.family}
                          </span>
                        )}

                        {std.superseded_by && (
                          <span className="compact-superseded-warning">
                            Superseded by: <strong>{std.superseded_by}</strong>
                          </span>
                        )}

                        {std.confidence !== undefined && (
                          <span className="compact-confidence-pill">
                            Relevance: {Math.round(std.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="compact-item-right">
                      <button
                        type="button"
                        className="compact-action-btn"
                        onClick={() => handleCopyStandard(std.is_number, uniqueKey)}
                        title={`Copy ${std.is_number}`}
                        aria-label={`Copy ${std.is_number}`}
                      >
                        {isCopied ? (
                          <>
                            <Check size={14} color="#15803d" />
                            <span style={{ color: "#15803d" }}>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {std.source_url && (
                        <a
                          href={std.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="compact-action-link"
                          title="Open official BIS documentation"
                        >
                          <ExternalLink size={14} />
                          <span>BIS Portal</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Initial Instructions if no search performed yet */}
      {results === null && !isLoading && !error && (
        <div className="analyzer-card search-intro-card">
          <div className="search-intro-grid">
            <div className="search-intro-box">
              <div className="search-intro-icon">
                <BookOpen size={20} />
              </div>
              <h4>Direct IS Lookup</h4>
              <p>
                Enter standard designations like <code>IS 694</code>, <code>IS 269</code>, <code>IS 10322</code>, or <code>IS 2925</code> to view titles, revisions, and active status.
              </p>
            </div>

            <div className="search-intro-box">
              <div className="search-intro-icon">
                <Search size={20} />
              </div>
              <h4>Keyword & Product Search</h4>
              <p>
                Search by product category like <code>cables</code>, <code>cement</code>, <code>water pipes</code>, or <code>street lights</code> powered by hybrid BM25 and semantic search.
              </p>
            </div>

            <div className="search-intro-box">
              <div className="search-intro-icon">
                <Layers size={20} />
              </div>
              <h4>Status & Supersession</h4>
              <p>
                Instantly identify if a standard is currently <strong>In Force</strong>, <strong>Withdrawn</strong>, or replaced by a modern revision.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
