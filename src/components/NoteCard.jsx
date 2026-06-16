export default function NoteCard({
  annotation,

  showManageActions = false,

  onEdit,
  onDelete,

  flippedFlashcards,
  toggleFlashcard,
  jumpToAnnotation,

  labelColors = {},
}) {
  const isFlashcard = annotation.noteType === "flashcard";
  const isFlipped = flippedFlashcards[annotation.id];

  const label = annotation.label || "Unlabeled";
  const labelColor = labelColors[label] || "#64748b";

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
      <div className="note-card-top-row">
        <span
          className="note-label compact-note-label"
          style={{ "--label-color": labelColor }}
        >
          {label}
        </span>

        {onDelete && (
          <button
            className="note-card-delete-x"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(annotation.id);
            }}
            aria-label="Delete note"
            title="Delete note"
          >
            ×
          </button>
        )}
      </div>

      <p className="compact-note-text">{displayText}</p>

      <div className="note-card-footer">
        <span className="note-card-meta">
          Page {annotation.pageNumber}
          {isFlashcard && ` · ${isFlipped ? "Back" : "Front"}`}
        </span>

        <div className="note-card-inline-actions">
          <button
            type="button"
            className="note-action-link source-action"
            onClick={(event) => {
              event.stopPropagation();
              jumpToAnnotation(annotation);
            }}
          >
            Source
          </button>

          {showManageActions && (
            <button
              type="button"
              className="note-action-link modify-action"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(annotation);
              }}
            >
              Modify
            </button>
          )}
        </div>
      </div>
    </div>
  );
}