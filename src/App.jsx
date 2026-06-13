import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";
import { createWorker } from "tesseract.js";
import AuthPanel from "./AuthPanel";
import { supabase } from "./supabaseClient";
import "./App.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = "linguatrace_annotations";

const STARTER_LABELS = [
  "Vocabulary",
  "Grammar",
  "Sentence",
  "Reading Clue",
  "Mistake",
  "Question",
];

export default function App() {
  const pageRef = useRef(null);
  const canvasRef = useRef(null);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [view, setView] = useState("reader");
  const [historyMode, setHistoryMode] = useState("byPdf");

  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [status, setStatus] = useState("Upload a language-learning PDF to start.");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.35);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  const [annotations, setAnnotations] = useState([]);
  const [draftRect, setDraftRect] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState(null);

  const [labelText, setLabelText] = useState("");
  const [customLabels, setCustomLabels] = useState(STARTER_LABELS);
  const [noteText, setNoteText] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingNote, setEditingNote] = useState("");

  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setAuthLoading(false);
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
        setAuthLoading(false);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAnnotations(parsed);

        const savedLabels = parsed
          .map((item) => item.label)
          .filter(Boolean)
          .filter((label) => !STARTER_LABELS.includes(label));

        setCustomLabels([...new Set([...savedLabels, ...STARTER_LABELS])]);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
  }, [annotations]);

  useEffect(() => {
    if (view === "reader" && pdfDoc && canvasRef.current && pageRef.current) {
      renderPage(pdfDoc, currentPage, scale);
    }
  }, [view]);

  async function signOut() {
    await supabase.auth.signOut();
    setView("reader");
    setPdfDoc(null);
    setPdfName("");
    setAnnotations([]);
    setDraftRect(null);
    setStatus("Signed out.");
  }

  async function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setPdfName(file.name);
    setStatus("Loading PDF...");
    setDraftRect(null);
    setLabelText("");
    setNoteText("");
    setExtractedText("");
    setExtractError("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setStatus(`Loaded: ${file.name}`);

      await renderPage(pdf, 1, scale);
    } catch {
      setStatus("Failed to load PDF.");
    }
  }

  async function extractTextWithOcrFromSelection() {
    if (!canvasRef.current || !draftRect) return "";

    const sourceCanvas = canvasRef.current;
    const cropCanvas = document.createElement("canvas");

    cropCanvas.width = draftRect.width;
    cropCanvas.height = draftRect.height;

    const cropContext = cropCanvas.getContext("2d");

    cropContext.drawImage(
      sourceCanvas,
      draftRect.x,
      draftRect.y,
      draftRect.width,
      draftRect.height,
      0,
      0,
      draftRect.width,
      draftRect.height
    );

    const worker = await createWorker("kor+eng");
    const result = await worker.recognize(cropCanvas);

    await worker.terminate();

    return result.data.text.replace(/\s+/g, " ").trim();
  }

  async function renderPage(pdf, pageNumber, nextScale = scale) {
    if (!canvasRef.current || !pageRef.current) return;

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: nextScale });

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    pageRef.current.style.width = `${viewport.width}px`;
    pageRef.current.style.height = `${viewport.height}px`;

    setPageSize({
      width: viewport.width,
      height: viewport.height,
    });

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;
  }

  async function goToPage(pageNumber) {
    if (!pdfDoc) {
      setStatus("Please upload the source PDF first.");
      return;
    }

    if (pageNumber < 1 || pageNumber > totalPages) return;

    setCurrentPage(pageNumber);
    setDraftRect(null);
    setLabelText("");
    setNoteText("");
    setExtractedText("");
    setExtractError("");
    setStatus(`Page ${pageNumber} / ${totalPages}`);
    setView("reader");

    await renderPage(pdfDoc, pageNumber, scale);
  }

  async function changeZoom(nextScale) {
    if (!pdfDoc) return;

    const safeScale = Math.min(2.4, Math.max(0.75, nextScale));

    setScale(safeScale);
    setDraftRect(null);
    setExtractedText("");
    setExtractError("");

    await renderPage(pdfDoc, currentPage, safeScale);
  }

  function getPoint(event) {
    const pageRect = pageRef.current.getBoundingClientRect();

    return {
      x: event.clientX - pageRect.left,
      y: event.clientY - pageRect.top,
    };
  }

  function handleMouseDown(event) {
    if (!pdfDoc) return;

    const point = getPoint(event);

    setIsDragging(true);
    setStartPoint(point);
    setExtractedText("");
    setExtractError("");

    setDraftRect({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    });
  }

  function handleMouseMove(event) {
    if (!isDragging || !startPoint) return;

    const currentPoint = getPoint(event);

    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    setDraftRect({ x, y, width, height });
  }

  function handleMouseUp() {
    if (!isDragging) return;

    setIsDragging(false);

    if (!draftRect || draftRect.width < 8 || draftRect.height < 8) {
      setDraftRect(null);
    }
  }

  function appendExtractedTextToNote(text) {
    const cleanText = text.trim();
    if (!cleanText) return;

    setExtractedText(cleanText);

    setNoteText((prev) => {
      if (!prev.trim()) return cleanText;
      return `${prev}\n\n${cleanText}`;
    });
  }

  async function extractTextFromSelection() {
    if (!pdfDoc || !draftRect || !pageSize.width || !pageSize.height) {
      return "";
    }

    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale });
    const textContent = await page.getTextContent();

    const selectionLeft = draftRect.x;
    const selectionRight = draftRect.x + draftRect.width;
    const selectionTop = draftRect.y;
    const selectionBottom = draftRect.y + draftRect.height;

    const selectedItems = textContent.items.filter((item) => {
      const transformed = pdfjsLib.Util.transform(
        viewport.transform,
        item.transform
      );

      const x = transformed[4];
      const y = transformed[5];

      const fontHeight = Math.abs(transformed[3]) || 10;
      const itemWidth = item.width * scale;

      const itemLeft = x;
      const itemRight = x + itemWidth;
      const itemTop = y - fontHeight;
      const itemBottom = y;

      return (
        itemRight >= selectionLeft &&
        itemLeft <= selectionRight &&
        itemBottom >= selectionTop &&
        itemTop <= selectionBottom
      );
    });

    return selectedItems
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function handleExtractText() {
    if (!draftRect) return;

    setIsExtracting(true);
    setExtractError("");

    try {
      let text = await extractTextFromSelection();

      if (!text.trim()) {
        text = await extractTextWithOcrFromSelection();
      }

      if (!text.trim()) {
        setExtractedText("");
        setExtractError("OCR could not recognize text in this selected area.");
        return;
      }

      appendExtractedTextToNote(text);
    } catch {
      setExtractError("Failed to extract or OCR text from this PDF selection.");
    } finally {
      setIsExtracting(false);
    }
  }

  async function copyExtractedText() {
    if (!extractedText) return;
    await navigator.clipboard.writeText(extractedText);
  }

  function saveAnnotation() {
    if (!draftRect || !pageSize.width || !pageSize.height) return;

    const finalLabel = labelText.trim() || "Unlabeled";

    const normalizedRect = {
      x: draftRect.x / pageSize.width,
      y: draftRect.y / pageSize.height,
      width: draftRect.width / pageSize.width,
      height: draftRect.height / pageSize.height,
    };

    const newAnnotation = {
      id: crypto.randomUUID(),
      pdfName,
      pageNumber: currentPage,
      rect: normalizedRect,
      label: finalLabel,
      note: noteText.trim(),
      extractedText: extractedText.trim(),
      createdAt: new Date().toISOString(),
    };

    setAnnotations((prev) => [newAnnotation, ...prev]);

    setCustomLabels((prev) => {
      if (prev.includes(finalLabel)) return prev;
      return [finalLabel, ...prev];
    });

    setDraftRect(null);
    setLabelText("");
    setNoteText("");
    setExtractedText("");
    setExtractError("");
    setStatus("Note saved locally.");
  }

  function deleteAnnotation(id) {
    setAnnotations((prev) => prev.filter((item) => item.id !== id));
  }

  function startEditAnnotation(annotation) {
    setEditingId(annotation.id);
    setEditingLabel(annotation.label || "");
    setEditingNote(annotation.note || "");
  }

  function cancelEditAnnotation() {
    setEditingId(null);
    setEditingLabel("");
    setEditingNote("");
  }

  function saveEditedAnnotation(id) {
    const finalLabel = editingLabel.trim() || "Unlabeled";

    setAnnotations((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              label: finalLabel,
              note: editingNote.trim(),
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );

    setCustomLabels((prev) => {
      if (prev.includes(finalLabel)) return prev;
      return [finalLabel, ...prev];
    });

    cancelEditAnnotation();
    setStatus("Note updated locally.");
  }

  async function jumpToAnnotation(annotation) {
    if (!pdfDoc) {
      setStatus("Please upload the source PDF first, then open this note.");
      setView("reader");
      return;
    }

    setView("reader");
    setCurrentPage(annotation.pageNumber);

    setDraftRect(null);
    setLabelText("");
    setNoteText("");
    setExtractedText("");
    setExtractError("");

    await renderPage(pdfDoc, annotation.pageNumber, scale);

    setTimeout(() => {
      const pageElement = pageRef.current;
      if (!pageElement) return;

      const targetY = annotation.rect.y * pageSize.height;

      pageElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      window.scrollBy({
        top: targetY - window.innerHeight / 2,
        behavior: "smooth",
      });
    }, 100);
  }

  function rectToStyle(rect) {
    return {
      left: rect.x * pageSize.width,
      top: rect.y * pageSize.height,
      width: rect.width * pageSize.width,
      height: rect.height * pageSize.height,
    };
  }

  function groupBy(items, keyGetter) {
    return items.reduce((groups, item) => {
      const key = keyGetter(item) || "Uncategorized";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});
  }

  const currentPageAnnotations = annotations.filter(
    (item) => item.pageNumber === currentPage && item.pdfName === pdfName
  );

  const latestNotes = annotations.slice(0, 5);

  const groupedHistory =
    historyMode === "byPdf"
      ? groupBy(annotations, (item) => item.pdfName || "Untitled PDF")
      : groupBy(annotations, (item) => item.label || "Unlabeled");

  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Loading LinguaTrace...</h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPanel />;
  }

  if (view === "history") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand" onClick={() => setView("reader")}>
            <span className="brand-mark">LT</span>
            <div>
              <h1>LinguaTrace</h1>
              <p>语迹 · Language Learning Notebook</p>
            </div>
          </div>

          <div className="card-actions">
            <button className="user-button" onClick={() => setView("reader")}>
              Back to Reader
            </button>

            <button className="user-button" onClick={signOut}>
              Sign Out
            </button>
          </div>
        </header>

        <main className="history-page">
          <div className="history-header">
            <div>
              <h2>Note History</h2>
              <p className="muted">
                Review notes by source PDF, label, vocabulary, grammar, or your
                own custom categories.
              </p>
            </div>

            <div className="segmented-control">
              <button
                className={historyMode === "byPdf" ? "active" : ""}
                onClick={() => setHistoryMode("byPdf")}
              >
                By PDF
              </button>

              <button
                className={historyMode === "byLabel" ? "active" : ""}
                onClick={() => setHistoryMode("byLabel")}
              >
                By Label
              </button>
            </div>
          </div>

          <div className="history-list">
            {annotations.length === 0 && (
              <div className="empty-card">No notes yet.</div>
            )}

            {Object.entries(groupedHistory).map(([groupName, groupNotes]) => (
              <section className="history-group" key={groupName}>
                <h3>
                  {groupName}
                  <span>{groupNotes.length} notes</span>
                </h3>

                {groupNotes.map((annotation) => (
                  <div className="history-card" key={annotation.id}>
                    <div>
                      <p className="page-info">
                        {annotation.pdfName || "Untitled PDF"} · Page{" "}
                        {annotation.pageNumber}
                      </p>

                      {editingId === annotation.id ? (
                        <>
                          <input
                            className="label-input"
                            value={editingLabel}
                            onChange={(event) =>
                              setEditingLabel(event.target.value)
                            }
                            placeholder="Edit label"
                          />

                          <div className="label-suggestions">
                            {customLabels.map((label) => (
                              <button
                                key={label}
                                type="button"
                                className={
                                  editingLabel === label
                                    ? "label-chip active"
                                    : "label-chip"
                                }
                                onClick={() => setEditingLabel(label)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>

                          <textarea
                            value={editingNote}
                            onChange={(event) =>
                              setEditingNote(event.target.value)
                            }
                            placeholder="Edit note"
                          />
                        </>
                      ) : (
                        <>
                          {annotation.label && (
                            <span className="note-label">
                              {annotation.label}
                            </span>
                          )}

                          <p className="note-body">
                            {annotation.note || "No note content."}
                          </p>

                          {annotation.extractedText && (
                            <p className="note-body">
                              {annotation.extractedText}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="card-actions">
                      {editingId === annotation.id ? (
                        <>
                          <button
                            onClick={() => saveEditedAnnotation(annotation.id)}
                          >
                            Save
                          </button>

                          <button onClick={cancelEditAnnotation}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => jumpToAnnotation(annotation)}>
                            Open Source
                          </button>

                          <button
                            onClick={() => startEditAnnotation(annotation)}
                          >
                            Modify
                          </button>

                          <button
                            className="delete-button"
                            onClick={() => deleteAnnotation(annotation.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">LT</span>
          <div>
            <h1>LinguaTrace</h1>
            <p>语迹 · Language Learning Notebook</p>
          </div>
        </div>

        <div className="card-actions">
          <button className="user-button" onClick={() => setView("history")}>
            User Info / Note History
          </button>

          <button className="user-button" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="left-panel">
          <div className="upload-row">
            <label className="upload-button">
              Upload PDF
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
              />
            </label>

            <span className="status-text">{status}</span>
          </div>

          <div className="viewer-card">
            <div className="viewer-header">
              <h2>PDF Viewer</h2>

              {totalPages > 0 && (
                <div className="toolbar">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>

                  <span>
                    Page {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>

                  <button onClick={() => changeZoom(scale - 0.1)}>-</button>
                  <span>{Math.round(scale * 100)}%</span>
                  <button onClick={() => changeZoom(scale + 0.1)}>+</button>
                </div>
              )}
            </div>

            <div className="pdf-area">
              <div
                ref={pageRef}
                className="pdf-page"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <canvas ref={canvasRef} className="pdf-canvas" />

                <div className="highlight-layer">
                  {currentPageAnnotations.map((annotation) => (
                    <div
                      key={annotation.id}
                      className="highlight saved-highlight"
                      style={rectToStyle(annotation.rect)}
                    />
                  ))}

                  {draftRect && (
                    <div
                      className="highlight draft-highlight"
                      style={{
                        left: draftRect.x,
                        top: draftRect.y,
                        width: draftRect.width,
                        height: draftRect.height,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="right-panel">
          <section className="note-editor-card">
            <h2>Add Note</h2>

            {draftRect ? (
              <>
                <p className="selected-text">
                  New highlight on Page {currentPage}
                </p>

                <button
                  type="button"
                  onClick={handleExtractText}
                  disabled={isExtracting}
                >
                  {isExtracting ? "Extracting..." : "Extract Text"}
                </button>

                {extractError && <p className="error-text">{extractError}</p>}

                {extractedText && (
                  <div className="ocr-result-card">
                    <div className="section-title-row">
                      <h3>Extracted Text</h3>

                      <button
                        type="button"
                        className="ghost-button"
                        onClick={copyExtractedText}
                      >
                        Copy
                      </button>
                    </div>

                    <p>{extractedText}</p>
                  </div>
                )}

                <div className="label-composer">
                  <input
                    className="label-input"
                    value={labelText}
                    onChange={(event) => setLabelText(event.target.value)}
                    placeholder="Create or choose a label"
                  />

                  <div className="label-suggestions">
                    {customLabels.map((label) => (
                      <button
                        key={label}
                        type="button"
                        className={
                          labelText === label
                            ? "label-chip active"
                            : "label-chip"
                        }
                        onClick={() => setLabelText(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Write meaning, grammar explanation, translation, or your mistake..."
                />

                <button onClick={saveAnnotation}>Save Note</button>
              </>
            ) : (
              <div className="placeholder">
                Drag over the PDF to create a highlight.
              </div>
            )}
          </section>

          <section className="latest-card">
            <div className="section-title-row">
              <h2>Latest Notes</h2>
              <button
                className="ghost-button"
                onClick={() => setView("history")}
              >
                View All
              </button>
            </div>

            <div className="notes-list">
              {latestNotes.length === 0 && (
                <div className="empty-card">No notes yet.</div>
              )}

              {latestNotes.map((annotation) => (
                <div className="note-card" key={annotation.id}>
                  <p className="page-info">
                    {annotation.pdfName || "Untitled PDF"} · Page{" "}
                    {annotation.pageNumber}
                  </p>

                  {annotation.label && (
                    <span className="note-label">{annotation.label}</span>
                  )}

                  <p>{annotation.note || "No note content."}</p>

                  <button onClick={() => jumpToAnnotation(annotation)}>
                    Go to Source
                  </button>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}