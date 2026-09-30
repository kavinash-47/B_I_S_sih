import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  Upload,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  FileCheck,
  RefreshCw,
  X,
  FileUp,
  Award,
  Layers,
  Search,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Info,
  ListChecks,
  AlertTriangle,
  Tag,
  UserCheck,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Edit3,
  StickyNote,
  History,
  ShieldCheck,
  User,
  Download,
  CheckCheck,
  Sun,
  Moon,
  Link2
} from "lucide-react";
import { jsPDF } from "jspdf";
import QuickStandardsSearch from "./QuickStandardsSearch";
import "./TenderAnalyzer.css";

// Product families supported by the BIS Auditor backend
const PRODUCT_FAMILIES = [
  { value: "", label: "-- Auto-detect / General (No checklist) --" },
  { value: "PVC cables", label: "PVC Cables (IS 694 / IS 1554)" },
  { value: "Cement", label: "Cement (IS 269 / IS 8112)" },
  { value: "LED street lights", label: "LED Street Lights (IS 10322 Part 5)" },
  { value: "Safety helmets", label: "Safety Helmets (IS 2925)" },
  { value: "uPVC water pipes", label: "uPVC Water Pipes (IS 4985)" },
];

// Sample tender texts for quick demo & testing
const SAMPLES = [
  {
    name: "PVC Cables (with Brand Flag)",
    family: "PVC cables",
    text: `Supply, laying, testing, and commissioning of 1.1 kV grade 4-core 16 sq.mm aluminium conductor, PVC insulated, PVC sheathed armoured electric cables conforming strictly to IS 694. Rated voltage: 450/750V. Preferred brand: Havells or Finolex. The tensile strength of insulation shall be minimum 12.5 N/mm2.`,
  },
  {
    name: "Portland Cement (IS 8112:2013)",
    family: "Cement",
    text: `Procurement of 43 Grade Ordinary Portland Cement (OPC) conforming to IS 8112:2013 for structural concrete works. Initial setting time shall not be less than 30 minutes, and 28-day compressive strength shall be minimum 43 MPa. Preferred brand: UltraTech Cement.`,
  },
  {
    name: "LED Street Lighting",
    family: "LED street lights",
    text: `Supply of 60W outdoor LED street lighting luminaires with high pressure die-cast aluminium housing, system efficacy >= 120 lm/W, CCT 5700K, conforming to IS 10322 (Part 5/Sec 3):2012 and IS 16103. Working voltage range: 140V to 270V AC.`,
  },
];

export default function TenderAnalyzer() {
  const [text, setText] = useState("");
  const [family, setFamily] = useState("");
  const [file, setFile] = useState(null);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [results, setResults] = useState(null);
  const [backendStatus, setBackendStatus] = useState("checking"); // 'online' | 'offline' | 'checking'

  // Theme state: defaults to dark theme using React state (not localStorage)
  const [darkMode, setDarkMode] = useState(true);

  // Top navigation view: "audit" for Full Tender Audit, "search" for Quick Standard Search
  const [activeView, setActiveView] = useState("audit");

  // Sync dark theme class on document.body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-theme");
      document.body.classList.remove("light-theme");
    } else {
      document.body.classList.add("light-theme");
      document.body.classList.remove("dark-theme");
    }
  }, [darkMode]);

  // Evidence expand/collapse state & cache
  const [expandedEvidence, setExpandedEvidence] = useState({});
  const [evidenceData, setEvidenceData] = useState({});

  // Related standards (bundle) expand/collapse state & cache: GET /api/standards/{is_number}/bundle
  const [expandedRelated, setExpandedRelated] = useState({});
  const [relatedData, setRelatedData] = useState({});

  // Why-not ranking explanation state & cache
  const [openWhyNot, setOpenWhyNot] = useState({});
  const [whyNotData, setWhyNotData] = useState({});

  // Accepted standards state: { [recKey]: boolean }
  const [acceptedStandards, setAcceptedStandards] = useState({});

  // Clause generation state & cache: { [recKey]: { text, originalText, note, isEdited, error } }
  const [clauseLoading, setClauseLoading] = useState({});
  const [clauseData, setClauseData] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);

  // Officer Verification & Audit Trail state
  const [officerName, setOfficerName] = useState("Procurement Officer");
  const [auditTrail, setAuditTrail] = useState([]);
  const [auditChainValid, setAuditChainValid] = useState(null);
  const [isFetchingAudit, setIsFetchingAudit] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [activeVerification, setActiveVerification] = useState({});
  const [verificationDecisions, setVerificationDecisions] = useState({});

  // Scorecard state fetched from /api/tenders/{id}/scorecard
  const [scorecardData, setScorecardData] = useState(null);
  const [isFetchingScorecard, setIsFetchingScorecard] = useState(false);
  const [scorecardError, setScorecardError] = useState("");

  // PDF Export state (POST /api/export/pdf)
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportPdfResult, setExportPdfResult] = useState(null);
  const [exportPdfError, setExportPdfError] = useState("");

  // Original tender text submitted for analysis
  const [originalTenderText, setOriginalTenderText] = useState("");

  // Before/After Report Export state (POST /api/export/before-after)
  const [isGeneratingBeforeAfter, setIsGeneratingBeforeAfter] = useState(false);
  const [exportBeforeAfterResult, setExportBeforeAfterResult] = useState(null);
  const [exportBeforeAfterError, setExportBeforeAfterError] = useState("");

  // Extracted Requirements modification state
  const [modifiedRequirements, setModifiedRequirements] = useState({});
  const [editingReqIndex, setEditingReqIndex] = useState(null);
  const [editingReqForm, setEditingReqForm] = useState({ newValue: "", reason: "" });
  const [isSubmittingReqModify, setIsSubmittingReqModify] = useState(false);

  // Session tender history state (past analyzed tenders for this session)
  const [pastTenders, setPastTenders] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [loadingPastTenderId, setLoadingPastTenderId] = useState(null);
  const selectedTenderIdRef = useRef(null);

  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Probe backend health endpoint with timeout and localhost fallback
  const probeHealth = async () => {
    const tryProbe = async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(url, { method: "GET", signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          return data.status === "ok" || typeof data.standards_loaded === "number";
        }
        return false;
      } catch {
        clearTimeout(timer);
        return false;
      }
    };

    let ok = await tryProbe("http://127.0.0.1:8000/health");
    if (!ok) {
      ok = await tryProbe("http://localhost:8000/health");
    }
    return ok;
  };

  const checkHealth = useCallback(async () => {
    setBackendStatus("checking");
    const ok = await probeHealth();
    setBackendStatus(ok ? "online" : "offline");
  }, []);

  // Check backend health on mount and continuously poll:
  // - Every 4 seconds when offline or checking (so it auto-recovers as soon as the server starts)
  // - Every 25 seconds when online (to keep status fresh without overhead)
  useEffect(() => {
    let active = true;

    const verify = async () => {
      const ok = await probeHealth();
      if (active) {
        setBackendStatus(ok ? "online" : "offline");
      }
    };

    verify();

    const intervalTime = backendStatus === "offline" ? 4000 : 25000;
    const timer = setInterval(() => {
      verify();
    }, intervalTime);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [backendStatus]);

  // Handle file selection (PDF or TXT)
  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    const isTxt = fileName.endsWith(".txt") || selectedFile.type === "text/plain";
    const isPdf = fileName.endsWith(".pdf") || selectedFile.type === "application/pdf";

    if (!isTxt && !isPdf) {
      setUploadError("Unsupported file type. Please upload a .pdf or .txt file.");
      return;
    }

    setFile(selectedFile);
    setUploadError("");
    setIsExtractingFile(true);

    try {
      if (isTxt) {
        // Plain text file: browser FileReader / text()
        const fileContent = await selectedFile.text();
        if (!fileContent.trim()) {
          throw new Error("The uploaded text file is empty.");
        }
        setText(fileContent);
      } else if (isPdf) {
        // PDF file: first attempt backend PyMuPDF extraction (/api/tenders/upload)
        let extracted = "";
        try {
          const formData = new FormData();
          formData.append("file", selectedFile);
          const uploadRes = await fetch("http://127.0.0.1:8000/api/tenders/upload", {
            method: "POST",
            body: formData,
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData.text) {
              extracted = uploadData.text;
            }
          }
        } catch {
          // Backend might be offline; fallback to client-side PDF parsing
        }

        // Fallback to client-side pdfjs if backend didn't return text
        if (!extracted) {
          try {
            const pdfjsLib = await import("pdfjs-dist");
            // Set worker source
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "3.11.174"}/pdf.worker.min.js`;
            }
            const buffer = await selectedFile.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: buffer });
            const pdfDoc = await loadingTask.promise;
            let fullText = "";

            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
              const page = await pdfDoc.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item) => item.str).join(" ");
              fullText += pageText + "\n";
            }
            extracted = fullText.trim();
          } catch (pdfErr) {
            throw new Error(`Failed to parse PDF file (${pdfErr.message || "Unknown error"}). Try pasting tender text directly.`);
          }
        }

        if (!extracted.trim()) {
          throw new Error("No extractable text found in this PDF (may be scanned images only).");
        }

        setText(extracted);
      }
    } catch (err) {
      setUploadError(err.message || "Failed to read file.");
    } finally {
      setIsExtractingFile(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploadError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Submit Handler: POST to http://127.0.0.1:8000/api/tenders/analyze
  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanText = text.trim();

    if (!cleanText) {
      setAnalyzeError("Please enter or upload tender specification text before submitting.");
      return;
    }

    setIsLoading(true);
    setAnalyzeError("");
    setResults(null);
    setExpandedEvidence({});
    setEvidenceData({});
    setOpenWhyNot({});
    setWhyNotData({});
    setAcceptedStandards({});
    setClauseLoading({});
    setClauseData({});
    setCopiedKey(null);
    setAuditTrail([]);
    setAuditChainValid(null);
    setActiveVerification({});
    setVerificationDecisions({});
    setScorecardData(null);
    setScorecardError("");
    setExportPdfResult(null);
    setExportPdfError("");
    setOriginalTenderText(cleanText);
    setExportBeforeAfterResult(null);
    setExportBeforeAfterError("");
    setModifiedRequirements({});
    setEditingReqIndex(null);

    const payload = {
      text: cleanText,
      family: family ? family : null,
    };

    try {
      const response = await fetch("http://127.0.0.1:8000/api/tenders/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMsg = `Server responded with status ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMsg = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
          }
        } catch {
          // ignore json parse error
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setBackendStatus("online");
      setResults({ ...data, original_text: data.original_text || cleanText });
      setOriginalTenderText(cleanText);

      if (data.scorecard) {
        setScorecardData(data.scorecard);
      }

      // Pre-accept top recommendation so Generate Clause is immediately available
      let initialAccepted = {};
      if (data.recommendations && data.recommendations.length > 0) {
        const topRec = data.recommendations[0];
        const topKey = `${topRec.is_number}_${topRec.part || ""}`;
        initialAccepted = { [topKey]: true };
        setAcceptedStandards(initialAccepted);
      }

      // Fetch running audit trail & scorecard from dedicated endpoints and record in session history
      if (data.tender_id) {
        selectedTenderIdRef.current = data.tender_id;
        fetchAuditTrail(data.tender_id);
        fetchScorecard(data.tender_id);

        const previewSnippet = cleanText.length > 120 ? cleanText.slice(0, 120).trim() + "..." : cleanText;
        // oxlint-disable-next-line react/purity
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const pastEntry = {
          tender_id: data.tender_id,
          text: cleanText,
          preview: previewSnippet,
          family: family || "",
          timestamp: timeStr,
          results: { ...data, original_text: data.original_text || cleanText },
          scorecard: data.scorecard || null,
          modifiedRequirements: {},
          acceptedStandards: initialAccepted,
        };

        setPastTenders((prev) => {
          const filtered = prev.filter((item) => item.tender_id !== data.tender_id);
          return [pastEntry, ...filtered];
        });
      }
    } catch (err) {
      setAnalyzeError(
        err.message ||
          "Could not connect to backend server at http://127.0.0.1:8000. Please make sure the backend is running (`python run.py`)."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Expand/collapse evidence section & fetch GET /api/recommendations/{is_number}/evidence
  const toggleEvidence = async (rec) => {
    const recKey = `${rec.is_number}_${rec.part || ""}`;
    const nextState = !expandedEvidence[recKey];
    setExpandedEvidence((prev) => ({ ...prev, [recKey]: nextState }));

    // If opening and not yet loaded, fetch evidence
    if (nextState && !evidenceData[recKey]?.data && !evidenceData[recKey]?.loading) {
      setEvidenceData((prev) => ({
        ...prev,
        [recKey]: { loading: true, data: null, error: null },
      }));

      try {
        const partParam = rec.part ? `?part=${encodeURIComponent(rec.part)}` : "";
        const res = await fetch(
          `http://127.0.0.1:8000/api/recommendations/${encodeURIComponent(rec.is_number)}/evidence${partParam}`
        );
        if (!res.ok) {
          throw new Error(`Failed to load evidence (HTTP ${res.status})`);
        }
        const data = await res.json();
        setEvidenceData((prev) => ({
          ...prev,
          [recKey]: { loading: false, data, error: null },
        }));
      } catch (err) {
        setEvidenceData((prev) => ({
          ...prev,
          [recKey]: { loading: false, data: null, error: err.message || "Failed to load evidence" },
        }));
      }
    }
  };

  // Expand/collapse related standards section & fetch GET /api/standards/{is_number}/bundle
  const toggleRelated = async (rec) => {
    const recKey = `${rec.is_number}_${rec.part || ""}`;
    const nextState = !expandedRelated[recKey];
    setExpandedRelated((prev) => ({ ...prev, [recKey]: nextState }));

    // If opening and not yet loaded, fetch bundle
    if (nextState && !relatedData[recKey]?.data && !relatedData[recKey]?.loading) {
      setRelatedData((prev) => ({
        ...prev,
        [recKey]: { loading: true, data: null, error: null },
      }));

      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/standards/${encodeURIComponent(rec.is_number)}/bundle`
        );
        if (!res.ok) {
          throw new Error(`Failed to load related standards (HTTP ${res.status})`);
        }
        const data = await res.json();
        setRelatedData((prev) => ({
          ...prev,
          [recKey]: { loading: false, data, error: null },
        }));
      } catch (err) {
        setRelatedData((prev) => ({
          ...prev,
          [recKey]: { loading: false, data: null, error: err.message || "Failed to load related standards" },
        }));
      }
    }
  };

  // "Why not shown higher" link for lower-ranked candidates: fetch GET /api/recommendations/{is_number}/why-not
  const toggleWhyNot = async (rec) => {
    const isNum = rec.is_number;
    const nextState = !openWhyNot[isNum];
    setOpenWhyNot((prev) => ({ ...prev, [isNum]: nextState }));

    // If opening and not yet loaded, fetch why-not
    if (nextState && !whyNotData[isNum]?.reason && !whyNotData[isNum]?.loading) {
      setWhyNotData((prev) => ({
        ...prev,
        [isNum]: { loading: true, reason: null, error: null },
      }));

      try {
        const param = text ? `?requirement_text=${encodeURIComponent(text.slice(0, 500))}` : "";
        const res = await fetch(
          `http://127.0.0.1:8000/api/recommendations/${encodeURIComponent(isNum)}/why-not${param}`
        );
        if (!res.ok) {
          throw new Error(`Failed to retrieve ranking reason (HTTP ${res.status})`);
        }
        const data = await res.json();
        setWhyNotData((prev) => ({
          ...prev,
          [isNum]: { loading: false, reason: data.reason, error: null },
        }));
      } catch (err) {
        setWhyNotData((prev) => ({
          ...prev,
          [isNum]: { loading: false, reason: null, error: err.message || "Failed to retrieve ranking reason" },
        }));
      }
    }
  };

  // Fetch running audit trail from GET /api/audit/{tender_id}
  const fetchAuditTrail = async (tenderId) => {
    if (!tenderId) return;
    setIsFetchingAudit(true);
    setAuditError("");
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/audit/${tenderId}`);
      if (!res.ok) {
        throw new Error(`Failed to load audit trail (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (selectedTenderIdRef.current && selectedTenderIdRef.current !== tenderId) {
        return;
      }
      setAuditTrail(data.audit_trail || []);
      setAuditChainValid(data.chain_valid || null);
    } catch (err) {
      if (selectedTenderIdRef.current && selectedTenderIdRef.current !== tenderId) {
        return;
      }
      setAuditError(err.message || "Failed to retrieve audit trail");
    } finally {
      setIsFetchingAudit(false);
    }
  };

  // Fetch scorecard from GET /api/tenders/{id}/scorecard
  const fetchScorecard = async (tenderId) => {
    if (!tenderId) return;
    setIsFetchingScorecard(true);
    setScorecardError("");
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/tenders/${tenderId}/scorecard`);
      if (!res.ok) {
        throw new Error(`Failed to load scorecard (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (selectedTenderIdRef.current && selectedTenderIdRef.current !== tenderId) {
        return;
      }
      setScorecardData(data);
    } catch (err) {
      console.warn("Could not fetch scorecard from server:", err);
      if (selectedTenderIdRef.current && selectedTenderIdRef.current !== tenderId) {
        return;
      }
      setScorecardError(err.message || "Failed to load scorecard");
    } finally {
      setIsFetchingScorecard(false);
    }
  };

  // Export PDF: POST to http://127.0.0.1:8000/api/export/pdf?tender_id={id} and download result
  const handleExportPdf = async () => {
    const tenderId = results?.tender_id;
    if (!tenderId) return;

    setIsExportingPdf(true);
    setExportPdfError("");

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/export/pdf?tender_id=${tenderId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        let errText = `Server returned HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.detail) errText = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
        } catch {}
        throw new Error(errText);
      }

      const backendResult = await response.json();

      // Client-side PDF generation & download using jsPDF
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 16;

      // Header Banner
      doc.setFillColor(31, 56, 100);
      doc.rect(0, 0, pageWidth, 24, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("BIS Tender Specification Auditor — Report", 14, 11);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Tender ID: #${tenderId}  |  Generated: ${new Date().toLocaleString()}`, 14, 18);

      y = 30;
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7.5);
      doc.text(
        "Advisory Specification Coverage Report — Bureau of Indian Standards (BIS) Catalog Cross-Reference. Not a legal compliance certification.",
        14,
        y
      );

      // Section 1: Executive Scorecard
      y += 8;
      doc.setTextColor(31, 56, 100);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("1. Specification Analysis Coverage Scorecard", 14, y);

      const sc = scorecardData || results?.scorecard || {};
      y += 6;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, "FD");

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Coverage: ${sc.overall_coverage_percent ?? 100}%`, 18, y + 7);
      doc.text(`Missing Required: ${sc.missing_required ?? results?.completeness?.missing_required_count ?? 0}`, 70, y + 7);
      doc.text(`Contradictions: ${sc.contradictions_found ?? results?.contradictions?.length ?? 0}`, 125, y + 7);
      doc.text(`Brand Flags: ${sc.brand_flags ?? results?.brand_findings?.length ?? 0}`, 165, y + 7);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Requirements: ${sc.requirements_covered ?? 0} / ${sc.requirements_identified ?? 0} covered`, 18, y + 14);
      doc.text(`In-force Recommended: ${sc.current_standards_recommended ?? 0}`, 70, y + 14);
      doc.text(`Superseded: ${sc.superseded_standards_recommended ?? 0}`, 125, y + 14);
      doc.text(`QCO Flags: ${sc.qco_review_flags ?? 0}`, 165, y + 14);

      // Section 2: Extracted Requirements
      y += 28;
      doc.setTextColor(31, 56, 100);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`2. Extracted Requirements (${results?.requirements?.length || 0})`, 14, y);

      y += 5;
      if (results?.requirements && results.requirements.length > 0) {
        doc.setFontSize(8);
        results.requirements.slice(0, 8).forEach((req) => {
          doc.setTextColor(30, 41, 59);
          doc.setFont("helvetica", "bold");
          doc.text(`• [${req.req_type}] ${req.value || ""}${req.unit ? " " + req.unit : ""}`, 18, y);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(100, 116, 139);
          const snippet = req.source_text ? `"${req.source_text.slice(0, 75)}${req.source_text.length > 75 ? "..." : ""}"` : "";
          doc.text(snippet, 80, y);
          y += 5;
        });
      } else {
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("No specific requirements extracted.", 18, y);
        y += 5;
      }

      // Section 3: Recommended Standards
      y += 4;
      doc.setTextColor(31, 56, 100);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`3. Recommended BIS Standards (${results?.recommendations?.length || 0})`, 14, y);

      y += 5;
      if (results?.recommendations && results.recommendations.length > 0) {
        doc.setFontSize(8);
        results.recommendations.slice(0, 6).forEach((rec) => {
          doc.setTextColor(21, 128, 61);
          doc.setFont("helvetica", "bold");
          const conf = `${(rec.confidence * 100).toFixed(0)}%`;
          doc.text(`${rec.is_number} ${rec.part ? `(${rec.part})` : ""} [${rec.status}] - Confidence: ${conf}`, 18, y);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(51, 65, 85);
          doc.text(`${(rec.title || "").slice(0, 85)}`, 18, y + 4);
          y += 9;
        });
      }

      // Section 4: Audit Trail Summary
      y += 4;
      doc.setTextColor(31, 56, 100);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`4. Verification Audit Trail (${auditTrail.length} Events)`, 14, y);

      y += 5;
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      auditTrail.slice(0, 6).forEach((record) => {
        doc.setFont("helvetica", "bold");
        doc.text(`[${(record.action || "").toUpperCase()}] ${record.record_id || ""} by ${record.officer || "Officer"}`, 18, y);
        doc.setFont("helvetica", "normal");
        const timeStr = record.timestamp ? new Date(record.timestamp).toLocaleTimeString() : "";
        doc.text(`${timeStr} | hash: ${(record.this_hash || "").slice(0, 16)}...`, 110, y);
        y += 5;
      });

      // Footer
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 280, pageWidth - 14, 280);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Report generated by BIS Tender Specification Auditor | Server Report: ${backendResult.pdf_report || ""}`, 14, 285);

      // Save file to download
      doc.save(`tender_${tenderId}_specification_audit_report.pdf`);

      setExportPdfResult({
        json_report: backendResult.json_report,
        pdf_report: backendResult.pdf_report,
        downloadedAt: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      setExportPdfError(err.message || "Failed to export PDF report");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Determine if at least one requirement has been modified via the Modify action
  const hasModifiedRequirement = Boolean(
    (modifiedRequirements && Object.keys(modifiedRequirements).length > 0) ||
    Object.values(verificationDecisions).some((v) => v?.action === "modify") ||
    (auditTrail && auditTrail.some((a) => a?.action === "modify"))
  );

  // Collect original tender text and the officer's edited/accepted version
  const collectBeforeAfterTexts = () => {
    const tenderId = results?.tender_id;

    // Get the currently-loaded tender's real text:
    // Prioritize results.original_text if it's a real tender specification,
    // or the current text in the editor, or originalTenderText.
    let original_text = "";
    if (results?.original_text && typeof results.original_text === "string" && !results.original_text.startsWith("BIS Tender Specification Auditor")) {
      original_text = results.original_text.trim();
    } else if (text && typeof text === "string" && !text.startsWith("BIS Tender Specification Auditor")) {
      original_text = text.trim();
    } else if (originalTenderText && typeof originalTenderText === "string" && !originalTenderText.startsWith("BIS Tender Specification Auditor")) {
      original_text = originalTenderText.trim();
    } else {
      original_text = (results?.original_text || text || originalTenderText || "").trim();
    }

    let revised_text = original_text;

    // Deduplicate officer modifications using a Map by target to prevent double-apply
    const modMap = new Map();

    // 1. Audit trail modifications (chronological)
    if (auditTrail && auditTrail.length > 0) {
      auditTrail.forEach((record) => {
        if (record.action === "modify" && record.new_value) {
          const target = (record.previous_value || record.record_id || "").trim();
          if (target) {
            modMap.set(target, {
              target,
              replacement: record.new_value.trim(),
              reason: record.reason,
            });
          }
        }
      });
    }

    // 2. Active verification decisions (override by target)
    Object.entries(verificationDecisions).forEach(([key, dec]) => {
      if (dec.action === "modify" && dec.new_value) {
        const target = (dec.previous_value || key.split("_")[0] || "").trim();
        if (target) {
          modMap.set(target, {
            target,
            replacement: dec.new_value.trim(),
            reason: dec.reason,
          });
        }
      }
    });

    // 3. Modified extracted requirements (override by target)
    if (modifiedRequirements) {
      Object.values(modifiedRequirements).forEach((mod) => {
        if (mod && mod.new_value) {
          const target = (mod.previous_value || mod.source_text || "").trim();
          if (target) {
            modMap.set(target, {
              target,
              replacement: mod.new_value.trim(),
              reason: mod.reason,
            });
          }
        }
      });
    }

    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Apply substitutions safely and idempotently (prevents duplicate suffixes like :2010:2010)
    const unappliedMods = [];
    modMap.forEach((mod) => {
      if (!mod.target || !mod.replacement || mod.target === mod.replacement) return;

      const escapedTarget = escapeRegExp(mod.target);
      // Determine if replacement appends a suffix (e.g., target: "IS 694", replacement: "IS 694:2010" -> suffix: ":2010")
      const suffix = mod.replacement.startsWith(mod.target)
        ? mod.replacement.slice(mod.target.length).trim()
        : "";

      // Regex ensures target is NOT replaced if already followed by the replacement suffix
      const regex = suffix
        ? new RegExp(`${escapedTarget}(?!\\s*${escapeRegExp(suffix)})`, "g")
        : new RegExp(`${escapedTarget}`, "g");

      if (regex.test(revised_text)) {
        regex.lastIndex = 0;
        revised_text = revised_text.replace(regex, mod.replacement);
      } else {
        const trimmedTarget = mod.target.trim();
        if (trimmedTarget && trimmedTarget !== mod.target) {
          const escTrim = escapeRegExp(trimmedTarget);
          const trimRegex = suffix
            ? new RegExp(`${escTrim}(?!\\s*${escapeRegExp(suffix)})`, "g")
            : new RegExp(`${escTrim}`, "g");
          if (trimRegex.test(revised_text)) {
            trimRegex.lastIndex = 0;
            revised_text = revised_text.replace(trimRegex, mod.replacement);
          } else {
            unappliedMods.push(mod);
          }
        } else {
          unappliedMods.push(mod);
        }
      }
    });

    // Clean up any potential duplicate year patterns (e.g. :2010:2010 -> :2010)
    revised_text = revised_text.replace(/(:[0-9]{4})(?::[0-9]{4})+/g, "$1");
    original_text = original_text.replace(/(:[0-9]{4})(?::[0-9]{4})+/g, "$1");

    // Append any modifications not directly matchable in the text
    if (unappliedMods.length > 0) {
      revised_text += "\n\nOfficer Specification Amendments (Modified via Verification):\n";
      unappliedMods.forEach((mod) => {
        revised_text += `• Modified [${mod.target}] → ${mod.replacement}${mod.reason ? ` (${mod.reason})` : ""}\n`;
      });
    }

    // Append officer-accepted/edited clauses
    const acceptedClauses = [];
    Object.entries(clauseData).forEach(([recKey, cData]) => {
      const isAccepted = acceptedStandards[recKey] || verificationDecisions[recKey]?.action === "accept";
      if ((isAccepted || cData.isEdited) && cData.text && cData.text.trim()) {
        acceptedClauses.push({
          standard: recKey.replace(/_/g, " ").trim(),
          text: cData.text.trim(),
          isEdited: cData.isEdited,
        });
      }
    });

    if (acceptedClauses.length > 0) {
      revised_text += "\n\nOfficer-Accepted Technical Clauses:\n";
      acceptedClauses.forEach((cl) => {
        revised_text += `• Standard ${cl.standard}${cl.isEdited ? " (Edited by Officer)" : ""}:\n  ${cl.text}\n\n`;
      });
    }

    if (revised_text.trim() === original_text.trim()) {
      revised_text += "\n\n[Officer Audit Review: Requirements verified and modified under BIS Tender Auditor.]";
    }

    return {
      tender_id: tenderId,
      original_text: original_text.trim(),
      revised_text: revised_text.trim(),
    };
  };

  // Generate Before/After Report: POST to /api/export/before-after and download resulting PDF
  const handleGenerateBeforeAfterReport = async () => {
    const tenderId = results?.tender_id;
    if (!tenderId) return;

    setIsGeneratingBeforeAfter(true);
    setExportBeforeAfterError("");

    try {
      const { original_text, revised_text } = collectBeforeAfterTexts();

      const response = await fetch("http://127.0.0.1:8000/api/export/before-after", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          tender_id: tenderId,
          original_text,
          revised_text,
        }),
      });

      if (!response.ok) {
        let errText = `Server returned HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.detail) {
            errText = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch {}
        throw new Error(errText);
      }

      const backendResult = await response.json();

      // Download the resulting PDF the same way the existing Export PDF button does:
      let downloaded = false;
      const pdfPath = backendResult.pdf_report || "";
      const filename = pdfPath ? pdfPath.replace(/\\/g, "/").split("/").pop() : `tender_${tenderId}_before_after.pdf`;

      // Try downloading the server-generated ReportLab PDF first
      try {
        const dlRes = await fetch(`http://127.0.0.1:8000/api/export/download/${filename}`);
        if (dlRes.ok) {
          const blob = await dlRes.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
          downloaded = true;
        }
      } catch (dlErr) {
        console.warn("Direct download from /api/export/download failed, falling back to client-side jsPDF", dlErr);
      }

      // If server download didn't trigger, generate & download client-side jsPDF
      if (!downloaded) {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 16;

        // Header Banner
        doc.setFillColor(31, 56, 100);
        doc.rect(0, 0, pageWidth, 24, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Before / After Specification Comparison", 14, 11);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        // oxlint-disable-next-line react/purity
        doc.text(`Tender ID: #${tenderId}  |  Generated: ${new Date().toLocaleString()}`, 14, 18);

        y = 30;
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7.5);
        doc.text("Advisory Specification Comparison Report — Bureau of Indian Standards (BIS)", 14, y);

        // Section 1: Original Specification
        y += 10;
        doc.setTextColor(31, 56, 100);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Original Specification", 14, y);

        y += 6;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        const origLines = doc.splitTextToSize(original_text, pageWidth - 28);
        doc.text(origLines.slice(0, 15), 14, y);
        y += Math.min(origLines.length, 15) * 4.5 + 8;

        // Section 2: Officer-Reviewed Specification
        doc.setTextColor(31, 56, 100);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Officer-Reviewed Specification", 14, y);

        y += 6;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(21, 128, 61);
        const revLines = doc.splitTextToSize(revised_text, pageWidth - 28);
        doc.text(revLines.slice(0, 18), 14, y);
        y += Math.min(revLines.length, 18) * 4.5 + 8;

        // Footer
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 280, pageWidth - 14, 280);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Report generated by BIS Tender Specification Auditor | File: ${filename}`, 14, 285);

        doc.save(filename);
      }

      setExportBeforeAfterResult({
        pdf_report: backendResult.pdf_report,
        filename: filename,
        // oxlint-disable-next-line react/purity
        downloadedAt: new Date().toLocaleTimeString(),
      });

      // Refresh running cryptographic audit trail
      await fetchAuditTrail(tenderId);
    } catch (err) {
      setExportBeforeAfterError(err.message || "Failed to generate Before/After report");
    } finally {
      setIsGeneratingBeforeAfter(false);
    }
  };

  // Modify an extracted requirement
  const handleConfirmReqModify = async (index, req) => {
    const tenderId = results?.tender_id;
    if (!tenderId) return;

    setIsSubmittingReqModify(true);
    const newVal = editingReqForm.newValue.trim();
    const reasonVal = editingReqForm.reason.trim() || `Officer modified requirement ${req.req_type}`;

    const payload = {
      tender_id: tenderId,
      record_id: `req_${index + 1}_${req.req_type}`,
      action: "modify",
      previous_value: String(req.value || req.source_text),
      new_value: newVal,
      reason: reasonVal,
      officer: officerName.trim() || "Procurement Officer",
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Failed to log requirement modification (${res.status})`);
      }

      setModifiedRequirements((prev) => {
        const nextMod = {
          ...prev,
          [index]: {
            previous_value: String(req.value || req.source_text),
            new_value: newVal,
            source_text: req.source_text,
            req_type: req.req_type,
            reason: reasonVal,
          },
        };

        setPastTenders((pastList) =>
          pastList.map((item) =>
            item.tender_id === tenderId
              ? { ...item, modifiedRequirements: nextMod }
              : item
          )
        );

        return nextMod;
      });

      setEditingReqIndex(null);
      await fetchAuditTrail(tenderId);
    } catch (err) {
      alert(err.message || "Failed to modify requirement");
    } finally {
      setIsSubmittingReqModify(false);
    }
  };

  // Open / toggle inline verification action form
  const handleActionClick = (rec, action) => {
    const recKey = `${rec.is_number}_${rec.part || ""}`;
    const current = activeVerification[recKey];

    // If currently open on the same action, toggle closed
    if (current?.isOpen && current?.action === action) {
      closeVerificationForm(recKey);
      return;
    }

    let defaultReason = "";
    if (action === "accept") {
      defaultReason = `Standard IS ${rec.is_number} verified and accepted by officer for tender technical specification.`;
    } else if (action === "reject") {
      defaultReason = `Standard IS ${rec.is_number} rejected — does not align with required tender scope.`;
    } else if (action === "modify") {
      defaultReason = `Standard IS ${rec.is_number} specification parameters modified.`;
    } else if (action === "note") {
      defaultReason = `Audit observation logged regarding compliance testing and certification requirements.`;
    }

    setActiveVerification((prev) => ({
      ...prev,
      [recKey]: {
        isOpen: true,
        action: action,
        reason: defaultReason,
        newValue: action === "modify" ? rec.is_number : "",
        submitting: false,
        error: null,
      },
    }));
  };

  const closeVerificationForm = (recKey) => {
    setActiveVerification((prev) => ({
      ...prev,
      [recKey]: { ...prev[recKey], isOpen: false, error: null },
    }));
  };

  // Submit verification: POST to http://127.0.0.1:8000/api/verification with {tender_id, record_id, action, reason, officer}
  const submitVerification = async (rec) => {
    const recKey = `${rec.is_number}_${rec.part || ""}`;
    const form = activeVerification[recKey];
    if (!form) return;

    const tenderId = results?.tender_id;
    if (!tenderId) {
      setActiveVerification((prev) => ({
        ...prev,
        [recKey]: { ...prev[recKey], error: "Missing active tender_id." },
      }));
      return;
    }

    setActiveVerification((prev) => ({
      ...prev,
      [recKey]: { ...prev[recKey], submitting: true, error: null },
    }));

    const payload = {
      tender_id: tenderId,
      record_id: rec.is_number,
      action: form.action,
      reason: form.reason?.trim() || `Officer ${form.action} on standard ${rec.is_number}`,
      officer: officerName.trim() || "Procurement Officer",
      previous_value: form.action === "modify" ? rec.is_number : undefined,
      new_value: form.action === "modify" ? (form.newValue?.trim() || rec.is_number) : form.action,
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/api/verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errText = `Server returned HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson.detail) errText = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
        } catch {}
        throw new Error(errText);
      }

      const verificationResult = await res.json();

      // Update accepted standards state: accept -> true, reject -> false
      if (form.action === "accept") {
        setAcceptedStandards((prev) => ({ ...prev, [recKey]: true }));
      } else if (form.action === "reject") {
        setAcceptedStandards((prev) => ({ ...prev, [recKey]: false }));
      }

      // Record verified decision for badge
      setVerificationDecisions((prev) => ({
        ...prev,
        [recKey]: {
          action: form.action,
          reason: form.reason,
          previous_value: form.action === "modify" ? rec.is_number : undefined,
          new_value: form.action === "modify" ? (form.newValue?.trim() || rec.is_number) : form.action,
          timestamp: new Date().toLocaleTimeString(),
          this_hash: verificationResult.this_hash,
        },
      }));

      // Close the inline form
      closeVerificationForm(recKey);

      // Refresh running cryptographic audit trail
      await fetchAuditTrail(tenderId);
    } catch (err) {
      setActiveVerification((prev) => ({
        ...prev,
        [recKey]: {
          ...prev[recKey],
          submitting: false,
          error: err.message || "Failed to log verification action",
        },
      }));
    }
  };

  // Toggle acceptance of a standard
  const toggleAcceptStandard = async (rec) => {
    const recKey = `${rec.is_number}_${rec.part || ""}`;
    const nextAccepted = !acceptedStandards[recKey];
    setAcceptedStandards((prev) => {
      const nextMap = { ...prev, [recKey]: nextAccepted };
      if (results?.tender_id) {
        setPastTenders((pastList) =>
          pastList.map((item) =>
            item.tender_id === results.tender_id
              ? { ...item, acceptedStandards: nextMap }
              : item
          )
        );
      }
      return nextMap;
    });

    // Log officer action to /api/verification
    if (results?.tender_id) {
      try {
        await fetch("http://127.0.0.1:8000/api/verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tender_id: results.tender_id,
            record_id: rec.is_number,
            action: nextAccepted ? "accept" : "reject",
            new_value: rec.is_number,
            reason: nextAccepted
              ? "Standard accepted by officer during specification audit"
              : "Standard unaccepted by officer",
            officer: officerName || "Procurement Officer",
          }),
        });
        fetchAuditTrail(results.tender_id);
      } catch (e) {
        console.warn("Could not log verification action:", e);
      }
    }
  };

  // Generate clause for an accepted standard: POST /api/clauses/generate with {is_number, part}
  const handleGenerateClause = async (rec) => {
    const recKey = `${rec.is_number}_${rec.part || ""}`;

    // Mark as accepted if not already accepted
    if (!acceptedStandards[recKey]) {
      setAcceptedStandards((prev) => {
        const nextMap = { ...prev, [recKey]: true };
        if (results?.tender_id) {
          setPastTenders((pastList) =>
            pastList.map((item) =>
              item.tender_id === results.tender_id
                ? { ...item, acceptedStandards: nextMap }
                : item
            )
          );
        }
        return nextMap;
      });
    }

    setClauseLoading((prev) => ({ ...prev, [recKey]: true }));

    try {
      const response = await fetch("http://127.0.0.1:8000/api/clauses/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          is_number: rec.is_number,
          part: rec.part || null,
        }),
      });

      if (!response.ok) {
        let errText = `Server responded with ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.detail) errText = errData.detail;
        } catch {
          // ignore
        }
        throw new Error(errText);
      }

      const data = await response.json();
      setClauseData((prev) => ({
        ...prev,
        [recKey]: {
          text: data.ai_generated_drafting_language || "",
          originalText: data.ai_generated_drafting_language || "",
          note: data.note || "",
          isEdited: false,
          error: null,
        },
      }));
    } catch (err) {
      setClauseData((prev) => ({
        ...prev,
        [recKey]: {
          text: "",
          originalText: "",
          note: "",
          isEdited: false,
          error: err.message || "Failed to generate clause",
        },
      }));
    } finally {
      setClauseLoading((prev) => ({ ...prev, [recKey]: false }));
    }
  };

  // Update clause text as officer edits it in the editable text box
  const updateClauseText = (recKey, newText) => {
    setClauseData((prev) => ({
      ...prev,
      [recKey]: {
        ...prev[recKey],
        text: newText,
        isEdited: true,
      },
    }));
  };

  // Copy drafted clause to clipboard
  const copyClause = (recKey) => {
    const textToCopy = clauseData[recKey]?.text;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedKey(recKey);
      setTimeout(() => {
        setCopiedKey(null);
      }, 2500);
    }
  };

  // Load and display a past analyzed tender from session state without re-analyzing
  const handleSelectPastTender = async (pastItem) => {
    if (!pastItem) return;
    const tenderId = pastItem.tender_id;
    selectedTenderIdRef.current = tenderId;
    setLoadingPastTenderId(tenderId);

    // Reset transient errors & states
    setAnalyzeError("");
    setUploadError("");
    setExportPdfError("");
    setExportPdfResult(null);
    setExportBeforeAfterError("");
    setExportBeforeAfterResult(null);
    setEditingReqIndex(null);
    setCopiedKey(null);

    // Set tender text, original text, and product family
    setText(pastItem.text || "");
    setOriginalTenderText(pastItem.text || "");
    setFamily(pastItem.family || "");

    // Restore modified requirements for this tender
    setModifiedRequirements(pastItem.modifiedRequirements || {});

    // Restore accepted standards if saved
    if (pastItem.acceptedStandards && Object.keys(pastItem.acceptedStandards).length > 0) {
      setAcceptedStandards(pastItem.acceptedStandards);
    } else if (pastItem.results?.recommendations && pastItem.results.recommendations.length > 0) {
      const topRec = pastItem.results.recommendations[0];
      const topKey = `${topRec.is_number}_${topRec.part || ""}`;
      setAcceptedStandards({ [topKey]: true });
    } else {
      setAcceptedStandards({});
    }

    // Reset inline verification forms
    setActiveVerification({});
    setVerificationDecisions({});

    // Display past analysis results immediately without calling /api/tenders/analyze
    setResults(pastItem.results);

    // Set initial scorecard if stored
    if (pastItem.scorecard || pastItem.results?.scorecard) {
      setScorecardData(pastItem.scorecard || pastItem.results.scorecard);
    }

    try {
      // Re-fetch scorecard and audit trail concurrently from dedicated GET endpoints
      await Promise.allSettled([
        fetchScorecard(tenderId),
        fetchAuditTrail(tenderId),
      ]);
    } finally {
      setLoadingPastTenderId(null);
    }
  };

  const loadSample = (sample) => {
    setText(sample.text);
    setFamily(sample.family);
    setFile(null);
    setUploadError("");
    setAnalyzeError("");
    setOriginalTenderText(sample.text);
  };

  return (
    <div className={`analyzer-container ${darkMode ? "dark-theme" : ""}`}>
      {/* Header */}
      <header className="analyzer-header">
        <div className="header-brand">
          <div className="header-icon-box">
            <BookOpen size={28} />
          </div>
          <div className="header-title-box">
            <h1>
              BIS Tender Specification Auditor
              <span className="header-badge">Advisory Engine</span>
            </h1>
            <p>Bureau of Indian Standards Specification Validation & QCO Verification</p>
          </div>
        </div>

        <div className="header-meta">
          <div className="status-indicator">
            <span className={`dot ${backendStatus}`}></span>
            <span>
              {backendStatus === "online"
                ? "Backend API: 127.0.0.1:8000 (Ready)"
                : backendStatus === "checking"
                ? "Checking API..."
                : "Backend Offline (127.0.0.1:8000)"}
            </span>
          </div>

          {/* Session Tender History Toggle */}
          <button
            type="button"
            className={`session-history-pill-btn ${isHistoryOpen ? "active" : ""}`}
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            title="Toggle session tender history panel"
          >
            <History size={15} />
            <span>History</span>
            <span className="history-pill-badge">{pastTenders.length}</span>
          </button>

          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="btn-secondary"
            style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", background: "transparent" }}
            onClick={() => checkHealth(false)}
            title="Refresh backend status"
          >
            <RefreshCw size={14} className={backendStatus === "checking" ? "spinner" : ""} />
          </button>
        </div>
      </header>

      {/* Top Navigation Tabs: Switch between Full Tender Audit and Quick Standard Search */}
      <nav className="main-nav-tabs">
        <button
          type="button"
          className={`main-nav-tab ${activeView === "audit" ? "active" : ""}`}
          onClick={() => setActiveView("audit")}
        >
          <FileCheck size={18} />
          <span>Full Tender Audit</span>
        </button>
        <button
          type="button"
          className={`main-nav-tab ${activeView === "search" ? "active" : ""}`}
          onClick={() => setActiveView("search")}
        >
          <Search size={18} />
          <span>Quick Standard Search</span>
        </button>
      </nav>

      {activeView === "audit" ? (
        <>
          {/* Session Analyzed Tenders Collapsible Panel */}
          <section className="session-history-section" aria-label="Session Analyzed Tenders">
            <div className={`session-history-panel ${isHistoryOpen ? "expanded" : "collapsed"}`}>
              <div
                className="session-history-header"
                onClick={() => setIsHistoryOpen((prev) => !prev)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsHistoryOpen((prev) => !prev);
                  }
                }}
              >
                <div className="session-history-header-left">
                  <div className="session-history-icon-box">
                    <History size={18} />
                  </div>
                  <div className="session-history-title-group">
                    <div className="session-history-title-row">
                      <h3 className="session-history-title">Session Tender History</h3>
                      <span className="session-history-count-badge">
                        {pastTenders.length} {pastTenders.length === 1 ? "tender" : "tenders"}
                      </span>
                      {results?.tender_id && (
                        <span className="session-history-active-chip">
                          <CheckCircle2 size={13} /> Active: Tender #{results.tender_id}
                        </span>
                      )}
                    </div>
                    <p className="session-history-subtitle">
                      Inspect past analyzed tenders for this session — re-fetches live scorecard & audit trail without re-analyzing.
                    </p>
                  </div>
                </div>

                <div className="session-history-header-right">
                  <button
                    type="button"
                    className="session-history-toggle-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsHistoryOpen((prev) => !prev);
                    }}
                    aria-label={isHistoryOpen ? "Collapse history panel" : "Expand history panel"}
                  >
                    <span>{isHistoryOpen ? "Collapse" : "Expand"}</span>
                    {isHistoryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Collapsed quick strip */}
              {!isHistoryOpen && pastTenders.length > 0 && (
                <div className="session-history-collapsed-strip">
                  <span className="collapsed-strip-label">Quick switch:</span>
                  <div className="collapsed-strip-chips">
                    {pastTenders.map((item) => {
                      const isSelected = results?.tender_id === item.tender_id;
                      return (
                        <button
                          key={item.tender_id}
                          type="button"
                          className={`collapsed-tender-chip ${isSelected ? "active" : ""}`}
                          onClick={() => handleSelectPastTender(item)}
                          title={`Tender #${item.tender_id}: ${item.preview}`}
                        >
                          <span className="chip-id">#{item.tender_id}</span>
                          {item.family && <span className="chip-family">{item.family}</span>}
                          {isSelected && <span className="chip-active-dot"></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expanded content */}
              {isHistoryOpen && (
                <div className="session-history-body">
                  {pastTenders.length === 0 ? (
                    <div className="session-history-empty">
                      <div className="empty-history-icon">
                        <History size={24} />
                      </div>
                      <div className="empty-history-text">
                        <strong>No past tenders analyzed in this session yet.</strong>
                        <p>Analyze a tender below using preset examples, manual text, or PDF upload. Analyzed tenders will appear here for instant recall without re-analyzing.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="session-history-cards-grid">
                      {pastTenders.map((item) => {
                        const isSelected = results?.tender_id === item.tender_id;
                        const sc = item.results?.scorecard || item.scorecard;
                        const coverage = sc?.overall_coverage_percent != null ? Math.round(sc.overall_coverage_percent) : 100;
                        const recCount = item.results?.recommendations?.length || 0;

                        return (
                          <div
                            key={item.tender_id}
                            className={`history-tender-card ${isSelected ? "is-selected" : ""}`}
                            onClick={() => handleSelectPastTender(item)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSelectPastTender(item);
                              }
                            }}
                          >
                            <div className="history-card-top">
                              <div className="history-card-id-row">
                                <span className="history-card-id">Tender #{item.tender_id}</span>
                                {isSelected ? (
                                  <span className="history-card-active-pill">
                                    <Check size={12} /> Active
                                  </span>
                                ) : (
                                  <span className="history-card-time">{item.timestamp}</span>
                                )}
                              </div>
                              {isSelected && <span className="history-card-time">{item.timestamp}</span>}
                            </div>

                            {item.family && (
                              <div className="history-card-family">
                                <Tag size={12} />
                                <span>{item.family}</span>
                              </div>
                            )}

                            <div className="history-card-preview-box">
                              <p className="history-card-preview-text">
                                "{item.preview}"
                              </p>
                            </div>

                            <div className="history-card-metrics">
                              <span className="history-metric-pill coverage">
                                Coverage: {coverage}%
                              </span>
                              <span className="history-metric-pill recs">
                                {recCount} {recCount === 1 ? "standard" : "standards"}
                              </span>
                            </div>

                            <div className="history-card-action-bar">
                              {isSelected ? (
                                <span className="history-action-status active">
                                  <CheckCheck size={14} /> Currently Loaded
                                </span>
                              ) : (
                                <span className="history-action-status click-load">
                                  <RefreshCw size={12} className={loadingPastTenderId === item.tender_id ? "spinner" : ""} /> Click to view & re-fetch
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Main Input Form Card */}
          <div className="analyzer-card">
        {/* Sample Templates Bar */}
        <div className="sample-bar">
          <span className="sample-label">
            <Layers size={14} /> Load Preset Example:
          </span>
          {SAMPLES.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              className="sample-chip"
              onClick={() => loadSample(sample)}
              disabled={isLoading}
            >
              {sample.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {/* Left: Text Area */}
            <div className="input-section">
              <div className="section-label">
                <span className="section-label-text">
                  <FileText size={16} /> Tender Specification Text
                </span>
                <div className="textarea-controls">
                  <span>{text.length.toLocaleString()} characters</span>
                  {text && (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setText("")}
                      disabled={isLoading}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <textarea
                className="tender-textarea"
                rows={10}
                placeholder="Paste the tender specification clause, scope of work, technical requirements, or standard citations here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isLoading || isExtractingFile}
                required
              />
            </div>

            {/* Right: Product Family & File Upload */}
            <div className="side-controls">
              {/* Product Family Dropdown */}
              <div className="field-group">
                <label className="field-label" htmlFor="family-select">
                  <Layers size={15} /> Product Family (Checklist)
                </label>
                <select
                  id="family-select"
                  className="field-select"
                  value={family}
                  onChange={(e) => setFamily(e.target.value)}
                  disabled={isLoading}
                >
                  {PRODUCT_FAMILIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="field-hint">
                  Selecting a family enables completeness checking against mandatory BIS checklist parameters.
                </span>
              </div>

              {/* File Upload for PDF/TXT */}
              <div className="field-group">
                <label className="field-label">
                  <Upload size={15} /> Upload Tender Document
                </label>

                {!file ? (
                  <div
                    className={`dropzone ${isDragActive ? "drag-active" : ""}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,application/pdf,text/plain"
                      className="file-input-hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChange(e.target.files[0]);
                        }
                      }}
                      disabled={isLoading || isExtractingFile}
                    />
                    <FileUp size={28} className="dropzone-icon" />
                    <div className="dropzone-title">Click to upload or drag & drop</div>
                    <div className="dropzone-sub">PDF or TXT documents (Max 15 MB)</div>
                  </div>
                ) : (
                  <div className="file-preview">
                    <div className="file-preview-info">
                      <FileCheck size={18} />
                      <span title={file.name}>
                        {file.name.length > 25 ? file.name.substring(0, 22) + "..." : file.name} (
                        {(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-remove-file"
                      onClick={removeFile}
                      title="Remove file"
                      disabled={isLoading || isExtractingFile}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {isExtractingFile && (
                  <div className="field-hint" style={{ color: "var(--info)", display: "flex", alignItems: "center", gap: 6 }}>
                    <RefreshCw size={12} className="spinner" /> Extracting text from document...
                  </div>
                )}

                {uploadError && (
                  <div className="field-hint" style={{ color: "var(--danger)" }}>
                    {uploadError}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="submit-bar">
            <div className="target-info">
              <span>Target: POST /api/tenders/analyze</span>
              <span>JSON: &#123; text, family &#125;</span>
            </div>

            <button
              type="submit"
              className="btn-submit"
              disabled={isLoading || isExtractingFile || !text.trim()}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="spinner" />
                  <span>Auditing Specification...</span>
                </>
              ) : (
                <>
                  <Search size={18} />
                  <span>Analyze Specification</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Loading State Banner / Card */}
      {isLoading && (
        <div className="loading-card">
          <div className="loading-content">
            <div className="loading-icon-pulse">
              <Search size={32} />
            </div>
            <h3 className="loading-title">Auditing Tender Specification...</h3>
            <p className="loading-subtitle">Cross-referencing technical requirements against the BIS Catalogue</p>

            <div className="loading-steps">
              <div className="loading-step-item active">
                <RefreshCw size={14} className="spinner" />
                <span>Extracting technical parameters, grades, and IS citations</span>
              </div>
              <div className="loading-step-item active">
                <RefreshCw size={14} className="spinner" />
                <span>Running BM25 keyword + semantic standard matching</span>
              </div>
              <div className="loading-step-item active">
                <RefreshCw size={14} className="spinner" />
                <span>Checking Quality Control Orders (QCO) & brand neutrality</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {analyzeError && (
        <div className="error-banner">
          <AlertCircle size={22} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="error-title">Analysis Request Failed</div>
            <p className="error-desc">{analyzeError}</p>
          </div>
        </div>
      )}

      {/* Analysis Results Display */}
      {results && !isLoading && (
        <div className="results-container">
          {/* Header Action */}
          <div className="results-header">
            <div className="results-header-left">
              <h2>Specification Audit Report (Tender #{results.tender_id})</h2>
              {pastTenders.length > 0 && (
                <div className="results-session-meta-row">
                  <span className="results-session-badge">
                    <History size={13} /> Session Tender #{results.tender_id}
                  </span>
                  <button
                    type="button"
                    className="btn-link-action"
                    onClick={() => {
                      fetchScorecard(results.tender_id);
                      fetchAuditTrail(results.tender_id);
                    }}
                    title="Re-fetch live scorecard and cryptographic audit trail from server"
                  >
                    <RefreshCw size={13} className={isFetchingScorecard || isFetchingAudit ? "spinner" : ""} />
                    <span>Re-fetch Live State</span>
                  </button>
                </div>
              )}
            </div>
            <div className="results-header-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setResults(null);
                  setText("");
                  setFile(null);
                  setOriginalTenderText("");
                  setModifiedRequirements({});
                  setEditingReqIndex(null);
                  setExportPdfResult(null);
                  setExportBeforeAfterResult(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                title="Start a fresh tender analysis"
              >
                + New Analysis
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <FileUp size={14} /> Edit Tender Text
              </button>
            </div>
          </div>

          {/* SPECIFICATION ANALYSIS SCORECARD SUMMARY CARD (GET /api/tenders/{id}/scorecard) */}
          {(() => {
            const activeScorecard = scorecardData || results.scorecard || {};
            const coveragePct = activeScorecard.overall_coverage_percent != null
              ? Math.round(activeScorecard.overall_coverage_percent)
              : 100;
            const missingCount = activeScorecard.missing_required ?? results.completeness?.missing_required_count ?? 0;
            const contradictionsCount = activeScorecard.contradictions_found ?? results.contradictions?.length ?? 0;
            const brandFlagsCount = activeScorecard.brand_flags ?? results.brand_findings?.length ?? 0;

            return (
              <div className="scorecard-summary-card">
                <div className="scorecard-summary-header">
                  <div className="scorecard-title-group">
                    <h3 className="scorecard-main-title">
                      <Award size={22} color="var(--primary)" />
                      <span>{activeScorecard.label || "Specification Analysis Coverage Scorecard"}</span>
                    </h3>
                    <span className="scorecard-endpoint-badge">
                      GET /api/tenders/{results.tender_id}/scorecard
                      {isFetchingScorecard && " (fetching update...)"}
                    </span>
                  </div>

                  <div className="scorecard-header-actions">
                    {/* Export PDF Button: POSTs to /api/export/pdf and downloads PDF */}
                    <button
                      type="button"
                      className="btn-export-pdf"
                      onClick={handleExportPdf}
                      disabled={isExportingPdf}
                      title="Export full specification audit report to PDF (POST /api/export/pdf)"
                    >
                      {isExportingPdf ? (
                        <>
                          <RefreshCw size={15} className="spinner" />
                          <span>Generating PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download size={15} />
                          <span>Export PDF</span>
                        </>
                      )}
                    </button>

                    {/* Generate Before/After Report Button: visible once at least one requirement has been modified via Modify action */}
                    {hasModifiedRequirement && (
                      <button
                        type="button"
                        className="btn-before-after"
                        onClick={handleGenerateBeforeAfterReport}
                        disabled={isGeneratingBeforeAfter}
                        title="Generate and download Before/After specification comparison report (POST /api/export/before-after)"
                      >
                        {isGeneratingBeforeAfter ? (
                          <>
                            <RefreshCw size={15} className="spinner" />
                            <span>Generating Report...</span>
                          </>
                        ) : (
                          <>
                            <FileCheck size={15} />
                            <span>Generate Before/After Report</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Scorecard Disclaimer */}
                <div className="scorecard-disclaimer-notice">
                  <Info size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Official Notice:</strong> {activeScorecard.disclaimer || "This is a specification-analysis coverage figure, NOT a legal compliance score."}
                  </span>
                </div>

                {/* 4 Summary Metrics (Coverage %, Missing Count, Contradictions, Flags) */}
                <div className="scorecard-metrics-grid">
                  {/* 1. Coverage % */}
                  <div className="metric-summary-box">
                    <div className="metric-box-top">
                      <div>
                        <div className="metric-box-label">Coverage %</div>
                        <div className="metric-box-desc">
                          {activeScorecard.requirements_covered ?? 0} of {activeScorecard.requirements_identified ?? results.requirements?.length ?? 0} parameters covered
                        </div>
                      </div>
                      <div className="metric-box-icon coverage">
                        <CheckCircle2 size={18} />
                      </div>
                    </div>

                    <div>
                      <div className={`metric-box-val ${coveragePct >= 75 ? "text-green" : coveragePct >= 40 ? "text-amber" : "text-red"}`}>
                        {coveragePct}%
                      </div>
                      <div className="metric-progress-bar">
                        <div
                          className="metric-progress-fill"
                          style={{
                            width: `${Math.min(100, Math.max(5, coveragePct))}%`,
                            background: coveragePct >= 75
                              ? "linear-gradient(90deg, #22c55e, #16a34a)"
                              : coveragePct >= 40
                              ? "linear-gradient(90deg, #facc15, #ca8a04)"
                              : "linear-gradient(90deg, #f87171, #dc2626)",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Missing Count */}
                  <div className="metric-summary-box">
                    <div className="metric-box-top">
                      <div>
                        <div className="metric-box-label">Missing Count</div>
                        <div className="metric-box-desc">Mandatory checklist requirements absent</div>
                      </div>
                      <div className="metric-box-icon missing">
                        <ShieldAlert size={18} />
                      </div>
                    </div>

                    <div className={`metric-box-val ${missingCount > 0 ? "text-red" : "text-green"}`}>
                      {missingCount}
                    </div>
                  </div>

                  {/* 3. Contradictions */}
                  <div className="metric-summary-box">
                    <div className="metric-box-top">
                      <div>
                        <div className="metric-box-label">Contradictions</div>
                        <div className="metric-box-desc">Technical threshold & unit conflicts</div>
                      </div>
                      <div className="metric-box-icon contradictions">
                        <AlertTriangle size={18} />
                      </div>
                    </div>

                    <div className={`metric-box-val ${contradictionsCount > 0 ? "text-red" : "text-green"}`}>
                      {contradictionsCount}
                    </div>
                  </div>

                  {/* 4. Flags (Brand & Restrictions) */}
                  <div className="metric-summary-box">
                    <div className="metric-box-top">
                      <div>
                        <div className="metric-box-label">Flags (Brand & Restrictive)</div>
                        <div className="metric-box-desc">Proprietary manufacturer specifications</div>
                      </div>
                      <div className="metric-box-icon flags">
                        <Tag size={18} />
                      </div>
                    </div>

                    <div className={`metric-box-val ${brandFlagsCount > 0 ? "text-amber" : "text-green"}`}>
                      {brandFlagsCount}
                    </div>
                  </div>
                </div>

                {/* Submetrics row */}
                <div className="scorecard-submetrics-bar">
                  <span className="submetric-pill">
                    Current In-Force Standards: <strong>{activeScorecard.current_standards_recommended ?? (results.recommendations?.filter(r => r.status === "in_force").length || 0)}</strong>
                  </span>
                  <span className="submetric-pill">
                    Superseded / Withdrawn: <strong>{activeScorecard.superseded_standards_recommended ?? (results.recommendations?.filter(r => r.status !== "in_force").length || 0)}</strong>
                  </span>
                  <span className="submetric-pill">
                    QCO Review Flags: <strong>{activeScorecard.qco_review_flags ?? (results.recommendations?.length || 0)}</strong>
                  </span>
                  <span className="submetric-pill">
                    Extracted Requirements: <strong>{results.requirements?.length || 0}</strong>
                  </span>
                </div>

                {/* Export PDF Confirmation Toast */}
                {exportPdfResult && (
                  <div className="export-toast-success">
                    <div className="export-toast-details">
                      <CheckCheck size={16} />
                      <span>
                        <strong>PDF Report Downloaded:</strong> <code>tender_{results.tender_id}_specification_audit_report.pdf</code> ({exportPdfResult.downloadedAt}).
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setExportPdfResult(null)}
                      style={{ color: "#166534", fontSize: "0.75rem", textDecoration: "underline" }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {scorecardError && (
                  <div className="evidence-error" style={{ marginTop: 12 }}>
                    <AlertCircle size={14} />
                    <span>Scorecard notice: {scorecardError}</span>
                  </div>
                )}

                {exportPdfError && (
                  <div className="evidence-error" style={{ marginTop: 12 }}>
                    <AlertCircle size={14} />
                    <span>{exportPdfError}</span>
                  </div>
                )}

                {/* Before/After Report Confirmation Toast */}
                {exportBeforeAfterResult && (
                  <div className="export-toast-success" style={{ borderColor: "#2563eb", background: "rgba(37, 99, 235, 0.08)", marginTop: 12 }}>
                    <div className="export-toast-details">
                      <CheckCheck size={16} color="#2563eb" />
                      <span>
                        <strong style={{ color: "#1d4ed8" }}>Before/After Report Downloaded:</strong> <code>{exportBeforeAfterResult.filename}</code> ({exportBeforeAfterResult.downloadedAt}).
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setExportBeforeAfterResult(null)}
                      style={{ color: "#1d4ed8", fontSize: "0.75rem", textDecoration: "underline" }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {exportBeforeAfterError && (
                  <div className="evidence-error" style={{ marginTop: 12 }}>
                    <AlertCircle size={14} />
                    <span>Before/After export notice: {exportBeforeAfterError}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 1. TABLE OF EXTRACTED REQUIREMENTS (req_type, value, source_text) */}
          <div className="section-block">
            <div className="section-heading">
              <FileText size={20} color="var(--primary)" />
              <h3>Extracted Requirements</h3>
              <span className="count-badge">{results.requirements?.length || 0}</span>
            </div>

            {results.requirements && results.requirements.length > 0 ? (
              <div className="data-table-wrapper">
                <table className="req-table">
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>req_type</th>
                      <th style={{ width: "25%" }}>value</th>
                      <th style={{ width: "37%" }}>source_text</th>
                      <th style={{ width: "18%" }}>action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.requirements.map((req, index) => {
                      const isModified = !!modifiedRequirements[index];
                      const isEditing = editingReqIndex === index;
                      return (
                        <React.Fragment key={index}>
                          <tr>
                            <td>
                              <span className="req-type-pill">{req.req_type}</span>
                            </td>
                            <td>
                              <span className="req-value">
                                {isModified ? modifiedRequirements[index].new_value : req.value}
                              </span>
                              {req.unit && <span className="req-unit">({req.unit})</span>}
                            </td>
                            <td className="source-text-cell">
                              "{req.source_text}"
                            </td>
                            <td>
                              {isModified ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  <span className="v-status-badge v-status-modify" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                                    MODIFIED
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-link"
                                    onClick={() => {
                                      setEditingReqIndex(index);
                                      setEditingReqForm({
                                        newValue: modifiedRequirements[index].new_value,
                                        reason: modifiedRequirements[index].reason || "",
                                      });
                                    }}
                                    style={{ fontSize: "0.75rem", textAlign: "left", cursor: "pointer", color: "var(--primary)" }}
                                  >
                                    Edit Again
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="v-btn v-btn-modify"
                                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                                  onClick={() => {
                                    setEditingReqIndex(index);
                                    setEditingReqForm({
                                      newValue: String(req.value || req.source_text || ""),
                                      reason: `Officer modified requirement ${req.req_type}`,
                                    });
                                  }}
                                  title="Modify this requirement"
                                >
                                  <Edit3 size={12} />
                                  <span>Modify</span>
                                </button>
                              )}
                            </td>
                          </tr>
                          {isEditing && (
                            <tr className="req-edit-row">
                              <td colSpan={4} style={{ padding: "12px 16px", background: "var(--gray-50, #f8fafc)" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                                    <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                                      Modified Value:
                                    </label>
                                    <input
                                      type="text"
                                      value={editingReqForm.newValue}
                                      onChange={(e) =>
                                        setEditingReqForm((prev) => ({ ...prev, newValue: e.target.value }))
                                      }
                                      style={{
                                        flex: 1,
                                        minWidth: 160,
                                        padding: "6px 10px",
                                        borderRadius: 4,
                                        border: "1px solid var(--gray-300, #cbd5e1)",
                                        fontSize: "0.85rem",
                                      }}
                                      placeholder="Enter modified requirement value..."
                                    />
                                    <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                                      Reason:
                                    </label>
                                    <input
                                      type="text"
                                      value={editingReqForm.reason}
                                      onChange={(e) =>
                                        setEditingReqForm((prev) => ({ ...prev, reason: e.target.value }))
                                      }
                                      style={{
                                        flex: 1.5,
                                        minWidth: 200,
                                        padding: "6px 10px",
                                        borderRadius: 4,
                                        border: "1px solid var(--gray-300, #cbd5e1)",
                                        fontSize: "0.85rem",
                                      }}
                                      placeholder="Audit justification..."
                                    />
                                    <button
                                      type="button"
                                      className="btn-v-submit btn-v-modify"
                                      style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                      onClick={() => handleConfirmReqModify(index, req)}
                                      disabled={isSubmittingReqModify}
                                    >
                                      {isSubmittingReqModify ? "Saving..." : "Confirm Modify"}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-v-cancel"
                                      style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                      onClick={() => setEditingReqIndex(null)}
                                      disabled={isSubmittingReqModify}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No requirements extracted from the tender specification.</p>
              </div>
            )}
          </div>

          {/* 2. CARD PER RECOMMENDED STANDARD (is_number, title, status badge [green/red], confidence score %) */}
          <div className="section-block">
            <div className="section-heading">
              <Award size={20} color="var(--primary)" />
              <h3>Recommended BIS Standards</h3>
              <span className="count-badge">{results.recommendations?.length || 0}</span>
            </div>

            {results.recommendations && results.recommendations.length > 0 ? (
              <div className="standards-cards-list">
                {results.recommendations.map((rec, index) => {
                  const isInForce = rec.status === "in_force";
                  const isRed = rec.status === "withdrawn" || rec.status === "superseded";
                  const confidencePct = `${(rec.confidence * 100).toFixed(1)}%`;
                  const confidenceRound = Math.round(rec.confidence * 100);
                  const recKey = `${rec.is_number}_${rec.part || ""}`;
                  const isEvidenceExpanded = !!expandedEvidence[recKey];
                  const isRelatedExpanded = !!expandedRelated[recKey];
                  const isWhyNotOpen = !!openWhyNot[rec.is_number];

                  return (
                    <div
                      key={index}
                      className={`standard-card ${
                        isInForce
                          ? "card-in_force"
                          : isRed
                          ? "card-superseded"
                          : "card-other"
                      }`}
                    >
                      <div className="standard-card-header">
                        <div className="standard-is-number-box">
                          <span className="standard-is-number">{rec.is_number}</span>
                          {rec.part && (
                            <span className="standard-part">({rec.part})</span>
                          )}
                        </div>

                        <div className="standard-header-right">
                          {/* Status Badge: Green for in_force, Red for withdrawn/superseded */}
                          <span
                            className={`status-badge ${
                              isInForce
                                ? "badge-green"
                                : isRed
                                ? "badge-red"
                                : "badge-gray"
                            }`}
                          >
                            {isInForce && <CheckCircle size={13} />}
                            {isRed && <AlertCircle size={13} />}
                            {rec.status.replace("_", " ")}
                          </span>

                          {/* Confidence Score as a Percentage */}
                          <span className="confidence-score-badge">
                            <span>Confidence:</span>
                            <strong>{confidencePct}</strong>
                          </span>
                        </div>
                      </div>

                      <h4 className="standard-card-title">{rec.title}</h4>

                      {/* Visual Confidence Progress Bar */}
                      <div className="confidence-meter-container">
                        <div className="confidence-meter-header">
                          <span>Match Confidence Score</span>
                          <strong>{confidencePct}</strong>
                        </div>
                        <div className="confidence-track">
                          <div
                            className={`confidence-fill ${
                              isInForce ? "fill-green" : isRed ? "fill-red" : "fill-amber"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, confidenceRound))}%` }}
                          />
                        </div>
                      </div>

                      {/* Officer Verification Action Buttons: Accept / Reject / Modify / Note */}
                      <div className="verification-toolbar">
                        <div className="verification-toolbar-label">
                          <UserCheck size={14} />
                          <span>Officer Verification:</span>
                        </div>

                        <div className="verification-btn-group">
                          <button
                            type="button"
                            className={`v-btn v-btn-accept ${
                              activeVerification[recKey]?.action === "accept" ||
                              verificationDecisions[recKey]?.action === "accept"
                                ? "active"
                                : ""
                            }`}
                            onClick={() => handleActionClick(rec, "accept")}
                            title="Accept this standard for tender specification"
                          >
                            <CheckCircle2 size={13} />
                            <span>Accept</span>
                          </button>

                          <button
                            type="button"
                            className={`v-btn v-btn-reject ${
                              activeVerification[recKey]?.action === "reject" ||
                              verificationDecisions[recKey]?.action === "reject"
                                ? "active"
                                : ""
                            }`}
                            onClick={() => handleActionClick(rec, "reject")}
                            title="Reject this standard"
                          >
                            <XCircle size={13} />
                            <span>Reject</span>
                          </button>

                          <button
                            type="button"
                            className={`v-btn v-btn-modify ${
                              activeVerification[recKey]?.action === "modify" ||
                              verificationDecisions[recKey]?.action === "modify"
                                ? "active"
                                : ""
                            }`}
                            onClick={() => handleActionClick(rec, "modify")}
                            title="Modify or specify replacement standard"
                          >
                            <Edit3 size={13} />
                            <span>Modify</span>
                          </button>

                          <button
                            type="button"
                            className={`v-btn v-btn-note ${
                              activeVerification[recKey]?.action === "note" ||
                              verificationDecisions[recKey]?.action === "note"
                                ? "active"
                                : ""
                            }`}
                            onClick={() => handleActionClick(rec, "note")}
                            title="Attach audit observation or compliance note"
                          >
                            <StickyNote size={13} />
                            <span>Note</span>
                          </button>
                        </div>

                        {verificationDecisions[recKey] && (
                          <span className={`v-status-badge v-status-${verificationDecisions[recKey].action}`}>
                            Verified: {verificationDecisions[recKey].action.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Inline Verification Form */}
                      {activeVerification[recKey]?.isOpen && (
                        <div className={`verification-inline-form form-${activeVerification[recKey].action}`}>
                          <div className="v-form-header">
                            <div className="v-form-title">
                              <strong>
                                {activeVerification[recKey].action === "accept" && "Accept Standard: "}
                                {activeVerification[recKey].action === "reject" && "Reject Standard: "}
                                {activeVerification[recKey].action === "modify" && "Modify Standard: "}
                                {activeVerification[recKey].action === "note" && "Add Audit Note for: "}
                                {rec.is_number} {rec.part ? `(${rec.part})` : ""}
                              </strong>
                            </div>
                            <button
                              type="button"
                              className="v-form-close"
                              onClick={() => closeVerificationForm(recKey)}
                              title="Close Form"
                            >
                              <X size={15} />
                            </button>
                          </div>

                          <div className="v-form-grid">
                            <div className="v-form-field">
                              <label>Officer / Auditor Name:</label>
                              <input
                                type="text"
                                value={officerName}
                                onChange={(e) => setOfficerName(e.target.value)}
                                placeholder="e.g. Procurement Officer"
                              />
                            </div>

                            {activeVerification[recKey].action === "modify" ? (
                              <div className="v-form-field">
                                <label>Modified Standard / Value:</label>
                                <input
                                  type="text"
                                  value={activeVerification[recKey].newValue || ""}
                                  onChange={(e) =>
                                    setActiveVerification((prev) => ({
                                      ...prev,
                                      [recKey]: { ...prev[recKey], newValue: e.target.value },
                                    }))
                                  }
                                  placeholder="e.g. IS 694:2010"
                                />
                              </div>
                            ) : (
                              <div className="v-form-field">
                                <label>Record ID / Standard:</label>
                                <input
                                  type="text"
                                  value={rec.is_number}
                                  disabled
                                  style={{ background: "#f1f5f9", cursor: "not-allowed" }}
                                />
                              </div>
                            )}

                            <div className="v-form-field" style={{ gridColumn: "span 2" }}>
                              <label>Reason / Audit Justification (Recorded in SHA-256 Hash Chain):</label>
                              <textarea
                                rows={2}
                                value={activeVerification[recKey].reason || ""}
                                onChange={(e) =>
                                  setActiveVerification((prev) => ({
                                    ...prev,
                                    [recKey]: { ...prev[recKey], reason: e.target.value },
                                  }))
                                }
                                placeholder="Enter justification for the audit trail..."
                              />
                            </div>
                          </div>

                          {activeVerification[recKey].error && (
                            <div className="v-form-error">
                              <AlertCircle size={14} />
                              <span>{activeVerification[recKey].error}</span>
                            </div>
                          )}

                          <div className="v-form-actions">
                            <button
                              type="button"
                              className="btn-v-cancel"
                              onClick={() => closeVerificationForm(recKey)}
                              disabled={activeVerification[recKey].submitting}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className={`btn-v-submit btn-v-${activeVerification[recKey].action}`}
                              onClick={() => submitVerification(rec)}
                              disabled={activeVerification[recKey].submitting}
                            >
                              {activeVerification[recKey].submitting ? (
                                <>
                                  <RefreshCw size={13} className="spinner" />
                                  <span>Writing to Audit Chain...</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck size={14} />
                                  <span>Confirm {activeVerification[recKey].action.toUpperCase()}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Card Action Controls: Acceptance, Generate Clause, Evidence toggle & Why not shown higher */}
                      <div className="standard-card-actions">
                        {/* 1. Accept Standard Toggle */}
                        {acceptedStandards[recKey] ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span className="badge-accepted">
                              <CheckCircle size={13} /> Accepted Standard
                            </span>
                            <button
                              type="button"
                              className="btn-unaccept"
                              onClick={() => toggleAcceptStandard(rec)}
                              title="Revoke acceptance"
                            >
                              (Undo)
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-accept-standard"
                            onClick={() => toggleAcceptStandard(rec)}
                            title="Accept this standard for tender drafting"
                          >
                            <CheckCircle size={14} />
                            <span>Accept Standard</span>
                          </button>
                        )}

                        {/* 2. Generate Clause Button (for each accepted standard) */}
                        {acceptedStandards[recKey] && (
                          <button
                            type="button"
                            className="btn-generate-clause"
                            onClick={() => handleGenerateClause(rec)}
                            disabled={clauseLoading[recKey]}
                            title="Generate verified specification clause from BIS catalogue"
                          >
                            <Sparkles size={14} />
                            <span>
                              {clauseLoading[recKey]
                                ? "Generating Clause..."
                                : clauseData[recKey]
                                ? "Regenerate Clause"
                                : "Generate Clause"}
                            </span>
                            {clauseLoading[recKey] && (
                              <RefreshCw size={12} className="spinner" />
                            )}
                          </button>
                        )}

                        {/* 3. Evidence Toggle */}
                        <button
                          type="button"
                          className="btn-toggle-evidence"
                          onClick={() => toggleEvidence(rec)}
                          aria-expanded={isEvidenceExpanded}
                        >
                          <BookOpen size={14} />
                          <span>{isEvidenceExpanded ? "Hide Evidence & Scope" : "View Evidence & Scope"}</span>
                          {isEvidenceExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {/* 4. Related Standards Toggle */}
                        <button
                          type="button"
                          className="btn-toggle-related"
                          onClick={() => toggleRelated(rec)}
                          aria-expanded={isRelatedExpanded}
                        >
                          <Link2 size={14} />
                          <span>{isRelatedExpanded ? "Hide Related Standards" : "Related Standards"}</span>
                          {isRelatedExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {/* 4. "Why not shown higher" link for lower-ranked candidates (index > 0) */}
                        {index > 0 && (
                          <button
                            type="button"
                            className="btn-why-not"
                            onClick={() => toggleWhyNot(rec)}
                            title="Understand why this candidate ranked lower than top recommendations"
                          >
                            <HelpCircle size={14} />
                            <span>{isWhyNotOpen ? "Hide ranking reason" : "Why not shown higher?"}</span>
                          </button>
                        )}
                      </div>

                      {/* Drafted Clause Box for Accepted Standard: POST /api/clauses/generate */}
                      {clauseData[recKey] && (
                        <div className="clause-generator-box">
                          <div className="clause-header">
                            <div className="clause-label-badge">
                              <Sparkles size={14} />
                              <span>AI-drafted — edit before use.</span>
                            </div>

                            <div className="clause-actions">
                              {copiedKey === recKey ? (
                                <span className="copied-indicator">
                                  <Check size={13} /> Copied!
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-copy-clause"
                                  onClick={() => copyClause(recKey)}
                                  title="Copy drafted clause to clipboard"
                                >
                                  <Copy size={13} /> Copy Clause
                                </button>
                              )}
                            </div>
                          </div>

                          {clauseData[recKey].error ? (
                            <div className="evidence-error">
                              <AlertCircle size={14} />
                              <span>{clauseData[recKey].error}</span>
                            </div>
                          ) : (
                            <>
                              <textarea
                                className="clause-textarea"
                                value={clauseData[recKey].text}
                                onChange={(e) => updateClauseText(recKey, e.target.value)}
                                rows={3}
                                placeholder="Drafted specification clause..."
                                aria-label="AI-drafted clause"
                              />

                              <div className="clause-footer">
                                <span className="clause-note">
                                  {clauseData[recKey].note ||
                                    "This clause is drafted from catalogue metadata only. Review and edit before inserting into tender document."}
                                </span>
                                {clauseData[recKey].isEdited && (
                                  <span className="edited-badge">Edited by Officer</span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Expandable Evidence Section: fetches GET /api/recommendations/{is_number}/evidence */}
                      {isEvidenceExpanded && (
                        <div className="evidence-panel">
                          <div className="evidence-panel-header">
                            <FileText size={15} />
                            <span>Standard Evidence & Scope: {rec.is_number} {rec.part ? `(${rec.part})` : ""}</span>
                          </div>

                          {evidenceData[recKey]?.loading && (
                            <div className="evidence-loading">
                              <RefreshCw size={14} className="spinner" />
                              <span>Fetching evidence from /api/recommendations/{rec.is_number}/evidence...</span>
                            </div>
                          )}

                          {evidenceData[recKey]?.error && (
                            <div className="evidence-error">
                              <AlertCircle size={14} />
                              <span>{evidenceData[recKey].error}</span>
                            </div>
                          )}

                          {evidenceData[recKey]?.data && (
                            <div className="evidence-content">
                              <div className="evidence-row">
                                <div className="evidence-label">scope_summary:</div>
                                <div className="evidence-value scope-summary-text">
                                  {evidenceData[recKey].data.scope_summary || "No scope summary available in database."}
                                </div>
                              </div>

                              <div className="evidence-row">
                                <div className="evidence-label">source_url:</div>
                                <div className="evidence-value">
                                  {evidenceData[recKey].data.source_url ? (
                                    <a
                                      href={evidenceData[recKey].data.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="evidence-source-link"
                                    >
                                      <span>{evidenceData[recKey].data.source_url}</span>
                                      <ExternalLink size={12} />
                                    </a>
                                  ) : (
                                    <span style={{ color: "var(--gray-500)" }}>None specified</span>
                                  )}
                                </div>
                              </div>

                              {evidenceData[recKey].data.verification && (
                                <div className="evidence-row">
                                  <div className="evidence-label">Verification:</div>
                                  <div className="evidence-value">
                                    <span className="badge badge-ok">{evidenceData[recKey].data.verification}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* "Why Not" Explanation Panel: fetches GET /api/recommendations/{is_number}/why-not */}
                      {index > 0 && isWhyNotOpen && (
                        <div className="why-not-panel">
                          <div className="why-not-header">
                            <HelpCircle size={15} color="var(--warning)" />
                            <strong>Ranking Explanation for {rec.is_number}:</strong>
                          </div>

                          {whyNotData[rec.is_number]?.loading && (
                            <div className="evidence-loading">
                              <RefreshCw size={14} className="spinner" />
                              <span>Fetching ranking factors from /why-not endpoint...</span>
                            </div>
                          )}

                          {whyNotData[rec.is_number]?.error && (
                            <div className="evidence-error">
                              <AlertCircle size={14} />
                              <span>{whyNotData[rec.is_number].error}</span>
                            </div>
                          )}

                          {whyNotData[rec.is_number]?.reason && (
                            <div className="why-not-reason">
                              <p>{whyNotData[rec.is_number].reason}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expandable Related Standards Section: fetches GET /api/standards/{is_number}/bundle */}
                      {isRelatedExpanded && (
                        <div className="related-standards-panel">
                          <div className="related-standards-header">
                            <Link2 size={15} />
                            <span>Related Standards: {rec.is_number} {rec.part ? `(${rec.part})` : ""}</span>
                          </div>

                          {relatedData[recKey]?.loading && (
                            <div className="evidence-loading">
                              <RefreshCw size={14} className="spinner" />
                              <span>Fetching related standards from /api/standards/{rec.is_number}/bundle...</span>
                            </div>
                          )}

                          {relatedData[recKey]?.error && (
                            <div className="evidence-error">
                              <AlertCircle size={14} />
                              <span>{relatedData[recKey].error}</span>
                            </div>
                          )}

                          {relatedData[recKey]?.data && (
                            (!relatedData[recKey].data.related || relatedData[recKey].data.related.length === 0) ? (
                              <div className="related-empty-state">
                                <Info size={14} />
                                <span>No linked standards recorded</span>
                              </div>
                            ) : (
                              <ul className="related-standards-list">
                                {relatedData[recKey].data.related.map((item, relIdx) => (
                                  <li key={relIdx} className="related-standard-item">
                                    <div className="related-item-header">
                                      <strong className="related-target-badge">{item.target_is_number}</strong>
                                      {item.relationship_type && (
                                        <span className="related-type-pill">
                                          {item.relationship_type.replace(/_/g, " ")}
                                        </span>
                                      )}
                                      {item.verification && (
                                        <span className="related-verification-pill">
                                          {item.verification}
                                        </span>
                                      )}
                                    </div>
                                    {item.description && (
                                      <p className="related-item-description">{item.description}</p>
                                    )}
                                    {item.source_url && (
                                      <a
                                        href={item.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="related-source-link"
                                        title="Official standard documentation"
                                      >
                                        <ExternalLink size={12} />
                                        <span>Official BIS Source</span>
                                      </a>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )
                          )}
                        </div>
                      )}

                      <div className="standard-card-footer">
                        <div className="meta-tags">
                          {rec.year && <span className="meta-pill">Year: {rec.year}</span>}
                          {rec.family && <span className="meta-pill">Family: {rec.family}</span>}
                          {rec.superseded_by && (
                            <span className="meta-pill superseded-warning">
                              Superseded by: {rec.superseded_by}
                            </span>
                          )}
                          {rec.penalty_reason && (
                            <span className="meta-pill superseded-warning">
                              {rec.penalty_reason}
                            </span>
                          )}
                        </div>

                        {rec.source_url && (
                          <a
                            href={rec.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bis-link"
                          >
                            <span>Official BIS Portal</span>
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <p>{results.no_match_message || "No BIS standards matched this tender specification."}</p>
              </div>
            )}
          </div>

          {/* 3. THREE SEPARATE FLAGGED LISTS: Completeness, Contradictions, Brand Findings */}
          <div className="flagged-lists-section">
            <h3 className="flagged-section-title">
              <ShieldAlert size={22} color="var(--primary)" />
              <span>Specification Audit Flagged Lists & Officer Actions</span>
            </h3>

            {/* LIST 1: SPECIFICATION COMPLETENESS FLAGS */}
            <div className="flagged-list-card">
              <div className="flagged-card-header">
                <div className="flagged-card-title-box">
                  <div className="flagged-card-icon completeness">
                    <ListChecks size={20} />
                  </div>
                  <div>
                    <h4 className="flagged-card-title">1. Specification Completeness Flags</h4>
                    <span style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>
                      {results.completeness?.family
                        ? `Product Family Checklist: ${results.completeness.family}`
                        : "General / No product family selected"}
                    </span>
                  </div>
                </div>

                <div>
                  {results.completeness?.checklist_found ? (
                    results.completeness.missing_required_count > 0 ? (
                      <span className="flag-count-pill has-flags">
                        {results.completeness.missing_required_count} Missing Required
                      </span>
                    ) : (
                      <span className="flag-count-pill clean">All Mandatory Covered</span>
                    )
                  ) : (
                    <span className="flag-count-pill neutral">No Checklist</span>
                  )}
                </div>
              </div>

              {results.completeness && results.completeness.checklist_found ? (
                <div className="flagged-items-list">
                  {results.completeness.items && results.completeness.items.length > 0 ? (
                    results.completeness.items.map((item, idx) => {
                      const isMissing = item.status === "MISSING";
                      const isOk = item.status === "OK";

                      return (
                        <div key={idx} className="flagged-item-box">
                          <div className="flagged-item-top">
                            <div className="flagged-item-title">
                              {isMissing ? (
                                <AlertCircle size={16} color="var(--danger)" />
                              ) : isOk ? (
                                <CheckCircle size={16} color="var(--success)" />
                              ) : (
                                <Info size={16} color="var(--gray-500)" />
                              )}
                              <span>{item.requirement}</span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="meta-pill">
                                {item.required ? "Mandatory" : "Optional"}
                              </span>
                              <span className={`status-badge ${isOk ? "badge-green" : isMissing ? "badge-red" : "badge-gray"}`}>
                                {item.status}
                              </span>
                            </div>
                          </div>

                          <div className="flagged-item-body">
                            {item.hint && (
                              <div style={{ fontSize: "0.825rem", color: "var(--gray-600)" }}>
                                <strong>Parameter Guidance:</strong> {item.hint}
                              </div>
                            )}
                            <div style={{ fontSize: "0.8rem", color: "var(--gray-500)", marginTop: 2 }}>
                              <strong>Detection Result:</strong> {item.coverage}
                            </div>
                          </div>

                          {/* Officer Action Text from API */}
                          <div
                            className={`officer-action-callout ${
                              isMissing ? "danger" : isOk ? "success" : "warning"
                            }`}
                          >
                            <UserCheck size={16} />
                            <span>
                              <strong>Officer Action:</strong> {item.action || "Manual review required"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flag-empty-box">Checklist has no items configured.</div>
                  )}
                </div>
              ) : (
                <div className="flag-empty-box">
                  {results.completeness?.message ||
                    "No product family specified for completeness checking. Select a product family from the dropdown (e.g. PVC cables, Cement, LED street lights) to audit against standard BIS checklist parameters."}
                </div>
              )}
            </div>

            {/* LIST 2: TECHNICAL & UNIT CONTRADICTIONS FLAGS */}
            <div className="flagged-list-card">
              <div className="flagged-card-header">
                <div className="flagged-card-title-box">
                  <div className="flagged-card-icon contradictions">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h4 className="flagged-card-title">2. Technical & Unit Contradictions</h4>
                    <span style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>
                      Minimum / Maximum value thresholds and unit dimensionality consistency
                    </span>
                  </div>
                </div>

                <div>
                  {results.contradictions && results.contradictions.length > 0 ? (
                    <span className="flag-count-pill has-flags">
                      {results.contradictions.length} Contradiction{results.contradictions.length > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="flag-count-pill clean">0 Contradictions / Clean</span>
                  )}
                </div>
              </div>

              {results.contradictions && results.contradictions.length > 0 ? (
                <div className="flagged-items-list">
                  {results.contradictions.map((c, idx) => (
                    <div key={idx} className="flagged-item-box">
                      <div className="flagged-item-top">
                        <div className="flagged-item-title">
                          <AlertTriangle size={16} color="var(--danger)" />
                          <span>{c.type}</span>
                        </div>
                        {c.minimum && c.maximum && (
                          <span className="meta-pill superseded-warning">
                            Min: {c.minimum} &gt; Max: {c.maximum}
                          </span>
                        )}
                      </div>

                      <div className="flagged-item-body">
                        <div>{c.detail}</div>
                        {c.source_text && (
                          <div className="flagged-quote">
                            "{c.source_text}"
                          </div>
                        )}
                      </div>

                      {/* Officer Action Text from API */}
                      <div className="officer-action-callout danger">
                        <UserCheck size={16} />
                        <span>
                          <strong>Officer Action:</strong> {c.action || "Flagged for officer review. Not auto-corrected."}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flag-clean-box">
                  <CheckCircle size={22} className="flag-clean-icon" />
                  <div>
                    <strong>No Contradictions Detected:</strong> All minimum/maximum limits and engineering units in the specification are mathematically consistent.
                    <div style={{ marginTop: 4, fontSize: "0.8rem", color: "#15803d" }}>
                      <strong>Officer Action:</strong> None required for unit contradictions.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* LIST 3: BRAND NEUTRALITY & RESTRICTIVENESS FLAGS */}
            <div className="flagged-list-card">
              <div className="flagged-card-header">
                <div className="flagged-card-title-box">
                  <div className="flagged-card-icon brands">
                    <Tag size={20} />
                  </div>
                  <div>
                    <h4 className="flagged-card-title">3. Brand Neutrality & Restrictiveness Flags</h4>
                    <span style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>
                      CVC / GFR compliance for anti-competitive manufacturer naming
                    </span>
                  </div>
                </div>

                <div>
                  {results.brand_findings && results.brand_findings.length > 0 ? (
                    <span className="flag-count-pill has-flags">
                      {results.brand_findings.length} Brand Flag{results.brand_findings.length > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="flag-count-pill clean">Brand-Neutral</span>
                  )}
                </div>
              </div>

              {results.brand_findings && results.brand_findings.length > 0 ? (
                <div className="flagged-items-list">
                  {results.brand_findings.map((bf, idx) => (
                    <div key={idx} className="flagged-item-box">
                      <div className="flagged-item-top">
                        <div className="flagged-item-title">
                          <Tag size={16} color="var(--warning)" />
                          <span>Brand Detected: <strong style={{ color: "var(--danger)" }}>{bf.brand}</strong></span>
                        </div>

                        <div>
                          {bf.or_equivalent_detected ? (
                            <span className="status-badge badge-green">
                              "or equivalent" present nearby
                            </span>
                          ) : (
                            <span className="status-badge badge-red">
                              Missing "or equivalent" clause
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flagged-item-body">
                        <div><strong>Finding Type:</strong> {bf.type}</div>
                        {bf.context && (
                          <div className="flagged-quote">
                            "{bf.context}"
                          </div>
                        )}
                      </div>

                      {/* Officer Action Text from API */}
                      <div
                        className={`officer-action-callout ${
                          bf.or_equivalent_detected ? "warning" : "danger"
                        }`}
                      >
                        <UserCheck size={16} />
                        <span>
                          <strong>Officer Action:</strong> {bf.action || "Officer review required."}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flag-clean-box">
                  <CheckCircle size={22} className="flag-clean-icon" />
                  <div>
                    <strong>Brand-Neutral Specification:</strong> No proprietary manufacturer names or trademarks detected in the tender text.
                    <div style={{ marginTop: 4, fontSize: "0.8rem", color: "#15803d" }}>
                      <strong>Officer Action:</strong> Compliant with CVC non-restrictive public procurement guidelines.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. RUNNING AUDIT TRAIL (Cryptographic SHA-256 Tamper-Evident Chain) */}
          <div className="section-block audit-trail-section">
            <div className="section-heading" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <History size={20} color="var(--primary)" />
                <h3>Officer Verification Audit Trail</h3>
                <span className="count-badge">{auditTrail.length} Logged Events</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {/* Hash Chain Integrity Badge */}
                {auditChainValid && (
                  <span
                    className={`audit-chain-badge ${
                      auditChainValid.valid ? "chain-valid" : "chain-broken"
                    }`}
                    title={
                      auditChainValid.valid
                        ? `SHA-256 Hash Chain Valid: All ${auditChainValid.records_checked} blocks verified`
                        : `Chain Integrity Warning: Broken at record #${auditChainValid.broken_at_record_id}: ${auditChainValid.reason}`
                    }
                  >
                    {auditChainValid.valid ? (
                      <>
                        <ShieldCheck size={14} />
                        <span>SHA-256 Chain Intact ({auditChainValid.records_checked} Verified)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} />
                        <span>Chain Broken (Record #{auditChainValid.broken_at_record_id})</span>
                      </>
                    )}
                  </span>
                )}

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: "5px 10px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 5 }}
                  onClick={() => fetchAuditTrail(results.tender_id)}
                  disabled={isFetchingAudit}
                  title="Refresh Audit Trail from GET /api/audit/{tender_id}"
                >
                  <RefreshCw size={13} className={isFetchingAudit ? "spinner" : ""} />
                  <span>Refresh Trail</span>
                </button>
              </div>
            </div>

            {auditError && (
              <div className="evidence-error" style={{ marginBottom: 12 }}>
                <AlertCircle size={14} />
                <span>{auditError}</span>
              </div>
            )}

            {isFetchingAudit && auditTrail.length === 0 ? (
              <div className="evidence-loading">
                <RefreshCw size={14} className="spinner" />
                <span>Loading running audit trail from GET /api/audit/{results.tender_id}...</span>
              </div>
            ) : auditTrail.length > 0 ? (
              <div className="audit-timeline">
                {auditTrail.map((record, idx) => (
                  <div key={record.id || idx} className="audit-timeline-item">
                    <div className="audit-item-left">
                      <span className={`audit-action-badge action-${record.action}`}>
                        {record.action}
                      </span>
                      <span className="audit-timestamp" title={record.timestamp}>
                        {record.timestamp ? new Date(record.timestamp).toLocaleTimeString() : "--:--"}
                      </span>
                    </div>

                    <div className="audit-item-main">
                      <div className="audit-item-header">
                        <span className="audit-record-id">
                          <strong>Target Standard / Record:</strong> <code>{record.record_id}</code>
                        </span>
                        <span className="audit-officer">
                          <User size={12} />
                          <span>{record.officer || "System"}</span>
                        </span>
                      </div>

                      {record.reason && (
                        <div className="audit-reason-text">
                          "{record.reason}"
                        </div>
                      )}

                      {record.new_value && record.action === "modify" && (
                        <div className="audit-new-val">
                          <strong>Modified Specification:</strong> <code>{record.new_value}</code>
                          {record.previous_value && (
                            <span style={{ color: "var(--gray-500)", marginLeft: 6 }}>
                              (original: <code>{record.previous_value}</code>)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Cryptographic SHA-256 Hash Chain Details */}
                      <div className="audit-hash-row">
                        <span title={`prev_hash: ${record.prev_hash}`}>
                          prev: <code>{record.prev_hash ? record.prev_hash.slice(0, 12) + "..." : "GENESIS"}</code>
                        </span>
                        <span>&rarr;</span>
                        <span title={`this_hash: ${record.this_hash}`}>
                          this: <code>{record.this_hash ? record.this_hash.slice(0, 12) + "..." : "---"}</code>
                        </span>
                        <span style={{ color: "#16a34a", display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                          <ShieldCheck size={12} /> Sealed
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No audit trail records logged for Tender #{results.tender_id} yet.</p>
              </div>
            )}
          </div>

          {/* Legal Advisory Disclaimer */}
          <div className="disclaimer-banner">
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <p>
              <strong>Official Advisory Notice:</strong> {results.disclaimer || "AI-assisted recommendation. This is advisory only and is NOT a legal compliance determination. Verify every standard, QCO status, and clause against the official BIS source before final procurement approval."}
            </p>
          </div>
        </div>
      )}
        </>
      ) : (
        <QuickStandardsSearch backendStatus={backendStatus} />
      )}
    </div>
  );
}
