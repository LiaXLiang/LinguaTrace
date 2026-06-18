import { useEffect, useMemo, useRef, useState } from "react";
import NoteCard from "./NoteCard";
import { groupBy } from "../lib/groupBy";

export default function HistoryPage({
  annotations,
  pdfLibrary,
  labelColors,
  historyMode,
  setHistoryMode,
  setView,
  signOut,
  openPdfFromLibrary,
  deletePdfDocument,

  flippedFlashcards,
  toggleFlashcard,
  jumpToAnnotation,

  editingId,
  editingLabel,
  setEditingLabel,
  editingNote,
  setEditingNote,
  editingCardFront,
  setEditingCardFront,
  editingCardBack,
  setEditingCardBack,

  editingNoteType,
  setEditingNoteType,

  customLabels,

  saveEditedAnnotation,
  cancelEditAnnotation,
  startEditAnnotation,
  deleteAnnotation,
}) {
  const [historyPage, setHistoryPage] = useState("notes"); // "notes" | "pdfs"
  const [activeGroupName, setActiveGroupName] = useState(null);
  const [previewLimit, setPreviewLimit] = useState(4);
  const historyContentRef = useRef(null);

  useEffect(() => {
    function updatePreviewLimit() {
      const width = historyContentRef.current?.offsetWidth || 1000;
      const cardWidth = 230;
      const gap = 18;
      const count = Math.floor((width + gap) / (cardWidth + gap));
      setPreviewLimit(Math.max(1, count));
    }

    updatePreviewLimit();

    const observer = new ResizeObserver(updatePreviewLimit);
    if (historyContentRef.current) {
      observer.observe(historyContentRef.current);
    }

    window.addEventListener("resize", updatePreviewLimit);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePreviewLimit);
    };
  }, []);

  const groupedHistory = useMemo(() => {
    return historyMode === "byPdf"
      ? groupBy(annotations, (item) => item.pdfName || "Untitled PDF")
      : groupBy(annotations, (item) => item.label || "Unlabeled");
  }, [annotations, historyMode]);

  const activeGroupNotes = activeGroupName
    ? groupedHistory[activeGroupName] || []
    : [];

  function renderEditCard(annotation) {
    return (
      <div className="history-card history-edit-card" key={annotation.id}>
        <div className="history-edit-form">
          <p className="page-info">
            {annotation.pdfName || "Untitled PDF"} · Page {annotation.pageNumber}
          </p>

          <input
            className="label-input"
            value={editingLabel}
            onChange={(event) => setEditingLabel(event.target.value)}
            placeholder="Edit label"
          />

          <div className="label-suggestions">
            {customLabels.map((label) => (
              <button
                key={label}
                type="button"
                className={editingLabel === label ? "label-chip active" : "label-chip"}
                style={{ "--label-color": labelColors[label] || "#64748b" }}
                onClick={() => setEditingLabel(label)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="note-type-switch">
            <button
              type="button"
              className={editingNoteType === "normal" ? "active" : ""}
              onClick={() => setEditingNoteType("normal")}
            >
              Normal Note
            </button>

            <button
              type="button"
              className={editingNoteType === "flashcard" ? "active" : ""}
              onClick={() => setEditingNoteType("flashcard")}
            >
              Flashcard
            </button>
          </div>

          {editingNoteType === "flashcard" ? (
            <>
              <input
                className="label-input"
                value={editingCardFront}
                onChange={(event) => setEditingCardFront(event.target.value)}
                placeholder="Edit front side"
              />

              <textarea
                value={editingCardBack}
                onChange={(event) => setEditingCardBack(event.target.value)}
                placeholder="Edit back side"
              />
            </>
          ) : (
            <textarea
              value={editingNote}
              onChange={(event) => setEditingNote(event.target.value)}
              placeholder="Edit note"
            />
          )}
        </div>

        <div className="history-edit-actions">
          <button type="button" onClick={() => saveEditedAnnotation(annotation.id)}>
            Save
          </button>
          <button type="button" className="user-button" onClick={cancelEditAnnotation}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function renderNoteCard(annotation) {
    if (editingId === annotation.id) {
      return renderEditCard(annotation);
    }

    return (
      <NoteCard
        key={annotation.id}
        annotation={annotation}
        showManageActions
        onEdit={startEditAnnotation}
        onDelete={deleteAnnotation}
        flippedFlashcards={flippedFlashcards}
        toggleFlashcard={toggleFlashcard}
        jumpToAnnotation={jumpToAnnotation}
        labelColors={labelColors}
      />
    );
  }

  function renderSavedPdfPage() {
    return (
      <main className="history-page">
        <div className="history-header">
          <div>
            <h2>Saved PDF</h2>
            <p className="muted">Open or manage your uploaded PDFs.</p>
          </div>

          <button className="user-button" onClick={() => setHistoryPage("notes")}>
            ← Back to Note History
          </button>
        </div>

        <section className="history-group saved-pdf-page">
          <h3>
            Saved PDF
            <span>{pdfLibrary.length} PDFs</span>
          </h3>

          {pdfLibrary.length === 0 && (
            <div className="empty-card">No saved PDFs yet.</div>
          )}

          <div className="saved-pdf-list">
            {pdfLibrary.map((pdfItem) => (
              <div className="history-card pdf-row-card" key={pdfItem.id}>
                <div>
                  <p className="page-info">
                    {pdfItem.totalPages || "?"} pages · Last opened page{" "}
                    {pdfItem.lastPage || 1}
                  </p>
                  <p className="pdf-row-title">{pdfItem.fileName}</p>
                </div>

                <div className="card-actions">
                  <button onClick={() => openPdfFromLibrary(pdfItem)}>
                    Open PDF
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => deletePdfDocument(pdfItem)}
                  >
                    Delete PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  function renderNotesPage() {
    return (
      <main className="history-page">
        <div className="history-header">
          <div>
            <h2>{activeGroupName || "Note History"}</h2>
            <p className="muted">
              {activeGroupName
                ? `${activeGroupNotes.length} notes in this collection.`
                : "Review notes by PDF, label, vocabulary, grammar, or your own custom categories."}
            </p>
          </div>

          {activeGroupName ? (
            <button className="user-button" onClick={() => setActiveGroupName(null)}>
              ← Back
            </button>
          ) : (
            <div className="history-header-actions">
              <button className="user-button" onClick={() => setHistoryPage("pdfs")}>
                View Saved PDF
              </button>

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
          )}
        </div>

      

          <div className="history-list" ref={historyContentRef}>
            {annotations.length === 0 && (
              <div className="empty-card">No notes yet.</div>
            )}

            {activeGroupName ? (
              <section className="history-subgroup">
                <h4>{activeGroupName}</h4>

                <div className="notes-list history-notes-grid">
                  {activeGroupNotes.map((annotation) => renderNoteCard(annotation))}
                </div>
              </section>
            ) : (
              Object.entries(groupedHistory).map(([groupName, groupNotes]) => {
                const previewNotes = groupNotes.slice(0, previewLimit);
                const hasMore = groupNotes.length > previewLimit;

                return (
                  <section className="history-subgroup" key={groupName}>
                    <div className="history-subgroup-header">
                      <h4>{groupName}</h4>
                      <span>{groupNotes.length} notes</span>
                    </div>

                    <div className="notes-list history-notes-grid">
                      {previewNotes.map((annotation) => renderNoteCard(annotation))}
                    </div>

                    {hasMore && (
                      <div className="history-group-action-row">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setActiveGroupName(groupName)}
                        >
                          View all →
                        </button>
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>
      </main>
    );
  }

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

        <nav className="topnav" aria-label="Main navigation">
          <button className="nav-link" onClick={() => setView("settings")}>
            Settings
          </button>

          <button className="nav-link" onClick={() => setView("reader")}>
            Reader
          </button>

          <button className="nav-link active" onClick={() => setView("history")}>
            Note History
          </button>

          <button className="nav-link signout-link" onClick={signOut}>
            Sign Out
          </button>
        </nav>
      </header>

      {historyPage === "pdfs" ? renderSavedPdfPage() : renderNotesPage()}
    </div>
  );
}