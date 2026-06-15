import NoteCard from "./NoteCard";
import { groupBy } from "../lib/groupBy";

export default function HistoryPage({
  annotations,
  pdfLibrary,
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

  customLabels,

  saveEditedAnnotation,
  cancelEditAnnotation,
  startEditAnnotation,
  deleteAnnotation,
}) {
  const groupedHistory =
    historyMode === "byPdf"
      ? groupBy(annotations, (item) => item.pdfName || "Untitled PDF")
      : groupBy(annotations, (item) => item.label || "Unlabeled");

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

        <section className="history-group">
          <h3>
            The PDF Codex
            <span>{pdfLibrary.length} PDFs</span>
          </h3>

          {pdfLibrary.length === 0 && (
            <div className="empty-card">No saved PDFs yet.</div>
          )}

          {pdfLibrary.map((pdfItem) => (
            <div className="history-card pdf-codex-card" key={pdfItem.id}>
              <div>
                <p className="page-info">
                  {pdfItem.totalPages || "?"} pages · Last opened page {" "}
                  {pdfItem.lastPage || 1}
                </p>
                <span className="note-label">Saved PDF</span>
                <p className="note-body">{pdfItem.fileName}</p>
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
        </section>

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

              <div className="notes-list history-notes-grid">
                {groupNotes.map((annotation) =>
                  editingId === annotation.id ? (
                    <div className="history-card" key={annotation.id}>
                      <div>
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
                              className={
                                editingLabel === label ? "label-chip active" : "label-chip"
                              }
                              onClick={() => setEditingLabel(label)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        <textarea
                          value={editingNote}
                          onChange={(event) => setEditingNote(event.target.value)}
                          placeholder="Edit note"
                        />
                      </div>

                      <div className="card-actions">
                        <button onClick={() => saveEditedAnnotation(annotation.id)}>
                          Save
                        </button>
                        <button onClick={cancelEditAnnotation}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <NoteCard
                      key={annotation.id}
                      annotation={annotation}
                      showManageActions
                      onEdit={startEditAnnotation}
                      onDelete={deleteAnnotation}
                      flippedFlashcards={flippedFlashcards}
                      toggleFlashcard={toggleFlashcard}
                      jumpToAnnotation={jumpToAnnotation}
                    />
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
