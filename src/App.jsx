import { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";
import "./App.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SCALE = 1.5;

export default function App() {
  const pageRef = useRef(null);
  const canvasRef = useRef(null);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [status, setStatus] = useState("Upload a TOPIK PDF to start.");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [annotations, setAnnotations] = useState([]);
  const [draftRect, setDraftRect] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState(null);

  const [labelText, setLabelText] = useState("");
  const [noteText, setNoteText] = useState("");

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
    setStatus(`PDF loaded. Total pages: ${pdf.numPages}`);

    await renderPage(pdf, 1);
  }

  async function renderPage(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: SCALE });

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    pageRef.current.style.width = `${viewport.width}px`;
    pageRef.current.style.height = `${viewport.height}px`;

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
    setStatus(`Showing page ${pageNumber} / ${totalPages}`);

    await renderPage(pdfDoc, pageNumber);
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
    if (!draftRect) return;

    const newAnnotation = {
      id: crypto.randomUUID(),
      pdfName,
      pageNumber: currentPage,
      rect: draftRect,
      label: labelText,
      note: noteText,
      createdAt: new Date().toISOString(),
    };

    setAnnotations((prev) => [...prev, newAnnotation]);
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

  const currentPageAnnotations = annotations.filter(
    (item) => item.pageNumber === currentPage
  );

  return (
    <div className="app">
      <header className="hero">
        <h1>Language Learning Platform</h1>
        <p className="subtitle">
          Upload PDFs, highlight important areas, and build your personal Korean
          learning notebook.
        </p>
      </header>

      <main className="content">
        <section className="upload-card">
          <h2>Upload PDF</h2>

          <input
            type="file"
            accept="application/pdf"
            onChange={handlePdfUpload}
          />

          {pdfName && <p className="hint">Current PDF: {pdfName}</p>}
          <p className="hint">{status}</p>
        </section>

        <section className="viewer-card">
          <div className="viewer-header">
            <h2>PDF Viewer</h2>

            {totalPages > 0 && (
              <div className="pagination">
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
                    style={{
                      left: annotation.rect.x,
                      top: annotation.rect.y,
                      width: annotation.rect.width,
                      height: annotation.rect.height,
                    }}
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
        </section>

        <section className="notes-card">
          <h2>Learning Notes</h2>

          {draftRect ? (
            <div className="note-editor">
              <p className="selected-text">
                New highlight on Page {currentPage}
              </p>

              <input
                className="label-input"
                value={labelText}
                onChange={(event) => setLabelText(event.target.value)}
                placeholder="Label，例如：生词 / 语法 / 句子 / 易错点"
              />

              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="写下这个区域里的韩语单词、语法、翻译、易错点..."
              />

              <button onClick={saveAnnotation}>Save Note</button>
            </div>
          ) : (
            <div className="placeholder">
              Drag on the PDF page to create a highlight.
            </div>
          )}

          <div className="notes-list">
            {annotations.map((annotation) => (
              <div className="note-card" key={annotation.id}>
                <p className="page-info">Page {annotation.pageNumber}</p>

                {annotation.label && (
                  <p className="note-label">{annotation.label}</p>
                )}

                <p>{annotation.note || "No note content."}</p>

                <button onClick={() => jumpToAnnotation(annotation)}>
                  Go to Page
                </button>

                <button
                  className="delete-button"
                  onClick={() => deleteAnnotation(annotation.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}