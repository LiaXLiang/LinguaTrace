import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";
import "./App.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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

  useEffect(() => {
    if (view === "reader" && pdfDoc && canvasRef.current && pageRef.current) {
      renderPage(pdfDoc, currentPage, scale);
    }
  }, [view]);

  async function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setPdfName(file.name);
    setStatus("Loading PDF...");
    setAnnotations([]);
    setDraftRect(null);
    setLabelText("");
    setNoteText("");

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    setPdfDoc(pdf);
    setTotalPages(pdf.numPages);
    setCurrentPage(1);
    setStatus(`Loaded: ${file.name}`);

    await renderPage(pdf, 1, scale);
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
    if (!pdfDoc) return;
    if (pageNumber < 1 || pageNumber > totalPages) return;

    setCurrentPage(pageNumber);
    setDraftRect(null);
    setLabelText("");
    setNoteText("");
    setStatus(`Page ${pageNumber} / ${totalPages}`);
    setView("reader");

    await renderPage(pdfDoc, pageNumber, scale);
  }

  async function changeZoom(nextScale) {
    if (!pdfDoc) return;

    const safeScale = Math.min(2.4, Math.max(0.75, nextScale));

    setScale(safeScale);
    setDraftRect(null);

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
  }

  function deleteAnnotation(id) {
    setAnnotations((prev) => prev.filter((item) => item.id !== id));
  }

  async function jumpToAnnotation(annotation) {
    await goToPage(annotation.pageNumber);
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
    (item) => item.pageNumber === currentPage
  );

  const latestNotes = annotations.slice(0, 5);

  const groupedHistory =
    historyMode === "byPdf"
      ? groupBy(annotations, (item) => item.pdfName || "Untitled PDF")
      : groupBy(annotations, (item) => item.label || "Unlabeled");

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

          <button className="user-button" onClick={() => setView("reader")}>
            Back to Reader
          </button>
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

                      {annotation.label && (
                        <span className="note-label">{annotation.label}</span>
                      )}

                      <p className="note-body">
                        {annotation.note || "No note content."}
                      </p>
                    </div>

                    <div className="card-actions">
                      <button onClick={() => jumpToAnnotation(annotation)}>
                        Open Source
                      </button>

                      <button
                        className="delete-button"
                        onClick={() => deleteAnnotation(annotation.id)}
                      >
                        Delete
                      </button>
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

        <button className="user-button" onClick={() => setView("history")}>
          User Info / Note History
        </button>
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
                <p className="selected-text">New highlight on Page {currentPage}</p>

                <div className="label-composer">
                  <input
                    className="label-input"
                    value={labelText}
                    onChange={(event) => setLabelText(event.target.value)}
                    placeholder="Create or choose a label, e.g. Particles / Honorifics / Vocabulary"
                  />

                  <div className="label-suggestions">
                    {customLabels.map((label) => (
                      <button
                        key={label}
                        type="button"
                        className={
                          labelText === label ? "label-chip active" : "label-chip"
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
              <button className="ghost-button" onClick={() => setView("history")}>
                View All
              </button>
            </div>

            <div className="notes-list">
              {latestNotes.length === 0 && (
                <div className="empty-card">No notes yet.</div>
              )}

              {latestNotes.map((annotation) => (
                <div className="note-card" key={annotation.id}>
                  <p className="page-info">Page {annotation.pageNumber}</p>

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