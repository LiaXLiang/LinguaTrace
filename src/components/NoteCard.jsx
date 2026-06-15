export default function NoteCard({
  annotation,

  showManageActions = false,

  onEdit,
  onDelete,

  flippedFlashcards,
  toggleFlashcard,
  jumpToAnnotation,
}) {
  const isFlashcard = annotation.noteType === "flashcard";
  const isFlipped = flippedFlashcards[annotation.id];

  const displayText = isFlashcard
    ? isFlipped
      ? annotation.cardBack || "Empty back"
      : annotation.cardFront || "Empty front"
    : annotation.note || "No note content.";

  return (
    <div
      className={
        isFlashcard
          ? "note-card compact-note-card flashcard-clickable"
          : "note-card compact-note-card"
      }
      onClick={() => {
        if (isFlashcard) toggleFlashcard(annotation.id);
      }}
    >
      <p className="page-info compact-page-info">
        {annotation.pdfName || "Untitled PDF"} · Page {annotation.pageNumber}
      </p>

      {annotation.label && (
        <span className="note-label compact-note-label">
          {annotation.label}
        </span>
      )}

      <p className="compact-note-text">{displayText}</p>

      {isFlashcard && (
        <p className="flashcard-hint">
          {isFlipped ? "Back" : "Front"} · Click to flip
        </p>
      )}

      <div className="note-card-actions">
        <button
          className="compact-source-button"
          onClick={(event) => {
            event.stopPropagation();
            jumpToAnnotation(annotation);
          }}
        >
          Go to Source
        </button>

        {showManageActions && (
          <>
            <button
              className="compact-secondary-button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(annotation);
              }}
            >
              Modify
            </button>

            <button
              className="compact-delete-button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(annotation.id);
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}