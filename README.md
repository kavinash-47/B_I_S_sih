# 🛡️ ManakAnvay: BIS Tender Specification Auditor

> **AI-Assisted Standards Verification for Government Procurement.**
> *Checking tender specifications against Indian Standards — advisory, sourced, and auditable.*

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-Prototype-orange.svg)

Smart India Hackathon 2026 · Problem Statement **SIH26108**
Ministry of Consumer Affairs, Food & Public Distribution

---

## 🎯 Mission Brief

Procurement officers currently check tender specifications against Bureau of Indian
Standards (BIS) manually — usually from memory or an old template. Standards get
revised, merged, and withdrawn regularly, so outdated citations slip through unnoticed.

**ManakAnvay** reads a tender specification, recommends the correct current BIS
standards, flags outdated or withdrawn citations, checks certification (QCO)
requirements as of a specific date, catches unit/contradiction errors, and flags
brand-locked wording — then produces a signed, exportable audit report.

It never claims legal compliance. Every recommendation is advisory and must be
verified against the official BIS source before use.

---

## ⚡ Core Features

| Feature | What It Does |
| :--- | :--- |
| **📄 Tender Analyzer** | Extracts product, material, requirements, and cited IS numbers from PDF/TXT/pasted text |
| **🔍 Standard Recommender** | Hybrid BM25 + semantic search, confidence-scored, refuses to guess below threshold |
| **📊 Evidence + "Why Not?"** | Shows source/scope for each match and explains why lower-ranked candidates weren't picked |
| **⚠️ Version / Merger Checker** | Flags citations to withdrawn or merged standards and names the current replacement |
| **🏷️ Dated QCO Checker** | Certification status evaluated as of a specific date — not a static yes/no |
| **🧮 Contradiction & Unit Checker** | Real unit-conversion logic catches impossible ranges (e.g. minimum > maximum) |
| **🔖 Brand Neutrality Checker** | Flags brand-specific wording missing an "or equivalent" clause |
| **✍️ Clause Generator** | Drafts a ready-to-edit specification clause from verified catalogue data only |
| **✅ Officer Verification** | Accept / Reject / Modify / Note workflow on every recommendation |
| **🔐 Tamper-Evident Audit Log** | SHA-256 hash-chained trail of every officer decision |
| **📑 PDF Export** | Full audit report, plus a Before/After comparison of the original vs. revised specification |

---

## 🏗️ Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React (Vite) |
| **Backend** | Python 3, FastAPI |
| **Database** | SQLite |
| **Search** | BM25 (keyword) + TF-IDF/cosine similarity (semantic), config-ready to upgrade to a transformer embedding model |
| **Unit checking** | pint |
| **PDF generation** | ReportLab |
| **Audit integrity** | SHA-256 hash chaining |
| **Testing** | pytest (43 automated tests) |

---

## 🔄 How It Works

1. Officer pastes or uploads a tender specification.
2. Backend extracts structured requirements (voltage, grade, dimensions, cited IS numbers).
3. Hybrid search ranks candidate BIS standards by confidence.
4. Version, QCO, contradiction, and brand checks run against the recommendation set.
5. Officer reviews each finding — accepts, rejects, modifies, or notes it.
6. A signed audit report is generated, with every decision hash-chained for integrity.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd bis_tender_auditor
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python scripts/init_db.py
python scripts/load_data.py
python run.py
```
API available at `http://127.0.0.1:8000` — interactive docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```
Access the app at the URL printed in the terminal (typically `http://localhost:3000`).

### Running Tests

```bash
cd bis_tender_auditor
python -m pytest tests/ -v
```

---

## 📊 Key API Endpoints

- `POST /api/tenders/analyze` — Run full analysis on tender text
- `GET /api/standards/search` — Keyword/semantic search across the standards catalogue
- `GET /api/standards/{is_number}/status` — Version/supersession check
- `GET /api/standards/{is_number}/qco` — Certification status as of a given date
- `POST /api/clauses/generate` — Draft a specification clause from verified data
- `POST /api/verification` — Log an officer decision (accept/reject/modify/note)
- `GET /api/audit/{tender_id}` — Retrieve and verify the tamper-evident audit trail
- `POST /api/export/pdf` — Generate the full audit report
- `POST /api/export/before-after` — Generate an original-vs-revised comparison report

---

## 📁 Data & Verification

Every standard, version link, and QCO event in `data/` carries a `verification` field —
`official` (confirmed on the BIS portal), `secondary` (a non-BIS source), or `unverified`.
This is a working prototype dataset (14 standards), not the full BIS catalogue, and the
unresolved gaps are documented rather than hidden — see `KNOWN_LIMITATIONS.md`.

---

## 👥 Project Info

- **Event:** Smart India Hackathon 2026
- **Problem Statement:** SIH26108
- **Category:** Software — Smart Automation
- **Classification:** Advisory tool — not a legal compliance system

---

**🛡️ ManakAnvay — Sourced. Explainable. Auditable.**
