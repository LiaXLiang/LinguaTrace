export function dbAnnotationToAppAnnotation(item) {
  return {
    id: item.id,
    pdfName: item.pdf_name,
    pageNumber: item.page_number,
    rect: item.rect,
    label: item.label,
    note: item.note || "",
    extractedText: item.extracted_text || "",
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    noteType: item.note_type || "normal",
    cardFront: item.card_front || "",
    cardBack: item.card_back || "",
  };
}

export function dbPdfToAppPdf(item) {
  return {
    id: item.id,
    userId: item.user_id,
    fileName: item.file_name,
    storagePath: item.storage_path,
    lastPage: item.last_page || 1,
    totalPages: item.total_pages || 0,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}
