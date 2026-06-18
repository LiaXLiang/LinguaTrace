import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";
import { createWorker } from "tesseract.js";
import AuthPanel from "./AuthPanel";
import NoteCard from "./components/NoteCard";
import HistoryPage from "./components/HistoryPage";
import SettingsPanel from "./components/SettingsPanel";
import CatAgentChat from "./components/CatAgentChat";
import { supabase } from "./supabaseClient";
import { STARTER_LABELS, PDF_BUCKET } from "./lib/constants";
import { dbAnnotationToAppAnnotation, dbPdfToAppPdf } from "./lib/mappers";
import "./App.css";


pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function App() {
  const pageRef = useRef(null);
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTaskRef = useRef(null);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [view, setView] = useState("reader");
  const [historyMode, setHistoryMode] = useState("byPdf");

  const [pdfDoc, setPdfDoc] = useState(null);
  const [activePdfId, setActivePdfId] = useState(null);
  const [pdfLibrary, setPdfLibrary] = useState([]);
  const [pdfName, setPdfName] = useState("");
  const [status, setStatus] = useState("Upload a language-learning PDF to start.");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.35);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  const [selectionToolbar, setSelectionToolbar] = useState(null);
  const [textSelection, setTextSelection] = useState("");
  const [nativeSelectionRects, setNativeSelectionRects] = useState([]);


  const [annotations, setAnnotations] = useState([]);
  const [draftRect, setDraftRect] = useState(null);
  const [sourceAnnotationId, setSourceAnnotationId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState(null);

  const [labelText, setLabelText] = useState("");
  const [customLabels, setCustomLabels] = useState(STARTER_LABELS);
  const [noteText, setNoteText] = useState("");

  const [noteType, setNoteType] = useState("normal");
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingNote, setEditingNote] = useState("");
  const [editingCardFront, setEditingCardFront] = useState("");
  const [editingCardBack, setEditingCardBack] = useState("");
  const [editingNoteType, setEditingNoteType] = useState("normal");

  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

  const [latestLimit, setLatestLimit] = useState(2);
  const [flippedFlashcards, setFlippedFlashcards] = useState({});

  const [agentOpen, setAgentOpen] = useState(false);
  const [savedPdfModalOpen, setSavedPdfModalOpen] = useState(false);

  const DEFAULT_AGENT_PROMPT_LABELS = [
    {
      id: "explain",
      title: "Explain",
      prompt: "Explain the selected text clearly and simply.",
    },
    {
      id: "examples",
      title: "More examples",
      prompt: "Give me more example sentences using the selected text.",
    },
  ];

  const [agentPromptLabels, setAgentPromptLabels] = useState(() => {
    const saved = localStorage.getItem("linguatrace-agent-prompt-labels");
    return saved ? JSON.parse(saved) : DEFAULT_AGENT_PROMPT_LABELS;
  });


  const LABEL_COLOR_PALETTE = [
    "#3b82f6",
    "#8b5cf6",
    "#22c55e",
    "#f97316",
    "#ef4444",
    "#14b8a6",
    "#ec4899",
    "#eab308",
    "#06b6d4",
    "#64748b",
  ];

    
  const [labelColors, setLabelColors] = useState(() => {
    const saved = localStorage.getItem("linguatrace-label-colors");
    return saved ? JSON.parse(saved) : {};
  });

  function getDefaultLabelColor(label) {
    let hash = 0;

    for (let i = 0; i < label.length; i += 1) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % LABEL_COLOR_PALETTE.length;
    return LABEL_COLOR_PALETTE[index];
  }
  
  function resetSelectionState() {
    setDraftRect(null);
    setNativeSelectionRects([]);
    setLabelText("");
    setNoteText("");
    setExtractedText("");
    setExtractError("");
    setNoteType("normal");
    setCardFront("");
    setCardBack("");
    setSelectionToolbar(null);
    setTextSelection("");
    window.getSelection()?.removeAllRanges();
  }

  async function loadAnnotations(currentUser) {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from("annotations")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus("Failed to load notes from database.");
      return;
    }

    const formatted = data.map(dbAnnotationToAppAnnotation);
    setAnnotations(formatted);

    const savedLabels = formatted
      .map((item) => item.label)
      .filter(Boolean)
      .filter((label) => !STARTER_LABELS.includes(label));

    setCustomLabels([...new Set([...savedLabels, ...STARTER_LABELS])]);
  }

  async function loadPdfLibrary(currentUser) {
    if (!currentUser) return [];

    const { data, error } = await supabase
      .from("pdf_documents")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("updated_at", { ascending: false });

    if (error) {
      setStatus("Failed to load your PDF Codex.");
      return [];
    }

    const formatted = data.map(dbPdfToAppPdf);
    setPdfLibrary(formatted);
    return formatted;
  }

  async function openPdfFromLibrary(pdfItem, targetPage = pdfItem.lastPage || 1) {
    console.log(pdfItem);
    if (!pdfItem) return;

    console.log("openPdfFromLibrary pdfItem:", pdfItem);

    if (!pdfItem.storagePath) {
      console.error("Missing storagePath in pdfItem:", pdfItem);
      setView("reader");
      setStatus("Cannot open PDF: missing storage path.");
      return;
    }

    setView("reader");
    setStatus(`Opening ${pdfItem.fileName}...`);
    resetSelectionState();

    try {
      const { data, error } = await supabase.storage
        .from(PDF_BUCKET)
        .download(pdfItem.storagePath);

      if (error) {
        console.error("Storage download error:", error);
        setStatus(`Failed to download PDF: ${error.message}`);
        return;
      }

      const arrayBuffer = await data.arrayBuffer();

      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      }).promise;

      const safePage = Math.min(Math.max(targetPage || 1, 1), pdf.numPages);

      setPdfDoc(pdf);
      setActivePdfId(pdfItem.id);
      setPdfName(pdfItem.fileName);
      setTotalPages(pdf.numPages);
      setCurrentPage(safePage);
      setStatus(`Loaded: ${pdfItem.fileName}`);

      await rememberCurrentPdfPage(safePage);
    } catch (error) {
      console.error("openPdfFromLibrary fatal error:", error);
      setStatus(`Failed to open PDF: ${error.message}`);
    }
  }

  async function rememberCurrentPdfPage(pageNumber) {
    if (!user || !activePdfId) return;

    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("pdf_documents")
      .update({ last_page: pageNumber, updated_at: updatedAt })
      .eq("id", activePdfId)
      .eq("user_id", user.id);

    if (!error) {
      setPdfLibrary((prev) =>
        prev.map((item) =>
          item.id === activePdfId
            ? { ...item, lastPage: pageNumber, updatedAt }
            : item
        )
      );
    }
  }

  async function bootstrapUser(currentUser) {
    if (!currentUser) return;

    await loadAnnotations(currentUser);
    const library = await loadPdfLibrary(currentUser);

    if (library.length > 0) {
      await openPdfFromLibrary(library[0], library[0].lastPage || 1);
    }
  }

  useEffect(() => {
    setLabelColors((prev) => {
      const next = { ...prev };
      let changed = false;

      customLabels.forEach((label) => {
        if (!next[label]) {
          next[label] = getDefaultLabelColor(label);
          changed = true;
        }
      });

      if (!next.Unlabeled) {
        next.Unlabeled = getDefaultLabelColor("Unlabeled");
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [customLabels]);

  useEffect(() => {
    localStorage.setItem(
      "linguatrace-agent-prompt-labels",
      JSON.stringify(agentPromptLabels)
    );
  }, [agentPromptLabels]);



  useEffect(() => {
    localStorage.setItem(
      "linguatrace-label-colors",
      JSON.stringify(labelColors)
    );
  }, [labelColors]);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const currentUser = data.user || null;

      setUser(currentUser);

      if (currentUser) {
        await bootstrapUser(currentUser);
      }

      setAuthLoading(false);
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user || null;

        setUser(currentUser);
        setAuthLoading(false);

        if (currentUser) {
          await bootstrapUser(currentUser);
        } else {
          setAnnotations([]);
          setPdfLibrary([]);
          setCustomLabels(STARTER_LABELS);
          setPdfDoc(null);
          setActivePdfId(null);
          setPdfName("");
          setTotalPages(0);
          setCurrentPage(1);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (view !== "reader") return;
    if (!pdfDoc) return;

    let cancelled = false;

    const timer = requestAnimationFrame(() => {
      if (cancelled) return;

      if (canvasRef.current && pageRef.current && textLayerRef.current) {
        renderPage(pdfDoc, currentPage, scale);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(timer);
    };
  }, [view, pdfDoc, currentPage, scale]);

  async function signOut() {
    await supabase.auth.signOut();

    setUser(null);
    setView("reader");
    setPdfDoc(null);
    setActivePdfId(null);
    setPdfLibrary([]);
    setPdfName("");
    setAnnotations([]);
    setCustomLabels(STARTER_LABELS);
    setDraftRect(null);
    setStatus("Signed out.");
  }

  async function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file || !user) return;

    setPdfName(file.name);
    setStatus("Uploading and loading PDF...");
    resetSelectionState();

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${Date.now()}-${safeFileName}`;

    console.log("Current user id:", user.id);
    console.log("Trying bucket:", PDF_BUCKET);

    const { error: uploadError } = await supabase.storage
      .from(PDF_BUCKET)
      .upload(storagePath, file, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      setStatus(`Upload failed: ${uploadError.message}`);
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const { data: pdfRow, error: dbError } = await supabase
        .from("pdf_documents")
        .insert({
          user_id: user.id,
          file_name: file.name,
          storage_path: storagePath,
          last_page: 1,
          total_pages: pdf.numPages,
        })
        .select()
        .single();

      if (dbError) {
        setStatus("PDF uploaded, but failed to save PDF metadata.");
        return;
      }

      const newPdf = dbPdfToAppPdf(pdfRow);

      setPdfLibrary((prev) => [newPdf, ...prev]);
      setPdfDoc(pdf);
      setActivePdfId(newPdf.id);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setView("reader");
      setStatus(`Loaded and saved: ${file.name}`);

    } catch {
      setStatus("Failed to load PDF.");
    } finally {
      event.target.value = "";
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
    if (!canvasRef.current || !pageRef.current || !textLayerRef.current) return;

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: nextScale });

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const textLayer = textLayerRef.current;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    pageRef.current.style.width = `${viewport.width}px`;
    pageRef.current.style.height = `${viewport.height}px`;

    textLayer.style.width = `${viewport.width}px`;
    textLayer.style.height = `${viewport.height}px`;
    textLayer.innerHTML = "";

    setPageSize({
      width: viewport.width,
      height: viewport.height,
    });

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    const renderTask = page.render({
      canvasContext: context,
      viewport,
    });

    renderTaskRef.current = renderTask;

    try {
      await renderTask.promise;
    } catch (error) {
      if (error?.name !== "RenderingCancelledException") {
        throw error;
      }
    } finally {
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
      }
    }

    // Build a selectable text layer on top of the canvas.
    // If the PDF has real text, users can select text directly.
    // If the PDF is scanned/image-only, this layer will simply stay empty.
    const textContent = await page.getTextContent();

    textContent.items.forEach((item) => {
      const transformed = pdfjsLib.Util.transform(
        viewport.transform,
        item.transform
      );

      const x = transformed[4];
      const y = transformed[5];
      const fontHeight = Math.abs(transformed[3]) || 10;
      const textWidth = Math.max(item.width * nextScale, 1);

      const span = document.createElement("span");
      span.textContent = item.str;
      span.className = "pdf-text-item";
      span.style.left = `${x}px`;
      span.style.top = `${y - fontHeight}px`;
      span.style.fontSize = `${fontHeight}px`;
      span.style.height = `${fontHeight * 1.25}px`;
      span.style.width = `${textWidth}px`;

      textLayer.appendChild(span);
    });
  }

  async function goToPage(pageNumber) {
    if (!pdfDoc) {
      setStatus("Please upload or open a saved PDF first.");
      return;
    }

    if (pageNumber < 1 || pageNumber > totalPages) return;

    setCurrentPage(pageNumber);
    resetSelectionState();
    setStatus(`Page ${pageNumber} / ${totalPages}`);
    setView("reader");

    await renderPage(pdfDoc, pageNumber, scale);
    await rememberCurrentPdfPage(pageNumber);
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

    if (event.target.closest(".selection-toolbar")) {
      return;
    }

    if (event.target.closest(".pdf-text-item")) {
      setDraftRect(null);
      setIsDragging(false);
      return;
    }

    const point = getPoint(event);

    setIsDragging(true);
    setStartPoint(point);
    setExtractedText("");
    setExtractError("");
    setSelectionToolbar(null);
    setTextSelection("");

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
    if (!isDragging) {
      handleNativeTextSelection();
      return;
    }

    setIsDragging(false);

    const hasNativeSelection = handleNativeTextSelection();

    if (hasNativeSelection) {
      setDraftRect(null);
      return;
    }

    if (!draftRect || draftRect.width < 8 || draftRect.height < 8) {
      setDraftRect(null);
      setSelectionToolbar(null);
      return;
    }

    setSelectionToolbar({
      x: Math.max(8, draftRect.x + draftRect.width - 120),
      y: Math.max(8, draftRect.y - 44),
      type: "rect",
    });
  }

  function placeToolbarAtRect(rect, pageRect, type, text = "") {
    const toolbarWidth = 120;
    const toolbarHeight = 36;
    const margin = 8;

    const rawX = rect.right - pageRect.left - toolbarWidth;
    const rawY = rect.top - pageRect.top - toolbarHeight - margin;

    const x = Math.max(margin, Math.min(rawX, pageRect.width - toolbarWidth - margin));
    const y = Math.max(margin, rawY);

    setSelectionToolbar({
      x,
      y,
      type,
      text,
    });
  }

  function handleNativeTextSelection() {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (!selectedText || !selection || selection.rangeCount === 0 || !pageRef.current) {
      setTextSelection("");
      return false;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const pageRect = pageRef.current.getBoundingClientRect();

    const clientRects = Array.from(range.getClientRects());

    setNativeSelectionRects(
      clientRects.map((clientRect) => ({
        x: clientRect.left - pageRect.left,
        y: clientRect.top - pageRect.top,
        width: clientRect.width,
        height: clientRect.height,
      }))
    );

    setTextSelection(selectedText);
    setExtractedText(selectedText);

    // Native text selection 不需要十字高亮框
    const boundingRect = {
      x: rect.left - pageRect.left,
      y: rect.top - pageRect.top,
      width: rect.width,
      height: rect.height,
    };

    setDraftRect(boundingRect);

    // 不显示浮动按钮
    setSelectionToolbar(null);

    return true;
  }



  function appendExtractedTextToNote(text) {
    const cleanText = text.trim();
    if (!cleanText) return;

    setExtractedText(cleanText);

    // In flashcard mode, the extracted word is a good default for the front side.
    // In normal-note mode, we do not automatically inject extracted text into the note,
    // so the user stays fully in control of what gets saved.
    if (noteType === "flashcard" && !cardFront.trim()) {
      setCardFront(cleanText);
    }
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

  async function handleFloatingExtractText(event) {
    event?.preventDefault();
    event?.stopPropagation();

    if (selectionToolbar?.type === "native" && textSelection.trim()) {
      const selected = textSelection.trim();

      setExtractedText(selected);

      if (noteType === "flashcard" && !cardFront.trim()) {
        setCardFront(selected);
      }

      setSelectionToolbar(null);
      return;
    }

    await handleExtractText();
    setSelectionToolbar(null);
  }

  async function copyExtractedText() {
    if (!extractedText) return;
    await navigator.clipboard.writeText(extractedText);
  }

  async function saveAnnotation() {
    if (!user) return;

    const finalExtractedText = extractedText.trim() || textSelection.trim();

    const hasManualNote =
      noteType === "normal" && noteText.trim();

    const hasFlashcard =
      noteType === "flashcard" &&
      (cardFront.trim() || cardBack.trim());

    if (!finalExtractedText && !hasManualNote && !hasFlashcard) {
      setStatus("Please write a note, create a flashcard, or select text first.");
      return;
    }

    const finalLabel = labelText.trim() || "Unlabeled";

    const normalizedRect =
      draftRect && pageSize.width && pageSize.height
        ? {
            x: draftRect.x / pageSize.width,
            y: draftRect.y / pageSize.height,
            width: draftRect.width / pageSize.width,
            height: draftRect.height / pageSize.height,
          }
        : null;

    const { data, error } = await supabase
      .from("annotations")
      .insert({
        user_id: user.id,
        pdf_name: pdfName || "Untitled PDF",
        page_number: currentPage,
        rect: normalizedRect,
        label: finalLabel,
        note: noteText.trim(),
        extracted_text: finalExtractedText,
        note_type: noteType,
        card_front: noteType === "flashcard" ? cardFront.trim() : "",
        card_back: noteType === "flashcard" ? cardBack.trim() : "",
      })
      .select()
      .single();

    if (error) {
      console.error("Save annotation error:", error);
      setStatus(`Failed to save note: ${error.message}`);
      return;
    }

    const newAnnotation = dbAnnotationToAppAnnotation(data);

    setAnnotations((prev) => [newAnnotation, ...prev]);

    setCustomLabels((prev) => {
      if (prev.includes(finalLabel)) return prev;
      return [finalLabel, ...prev];
    });

    resetSelectionState();
    setStatus("Note saved.");
  }

  async function deleteAnnotation(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this note? This action cannot be undone."
    );

    if (!confirmed) return;

    const { error } = await supabase.from("annotations").delete().eq("id", id);

    if (error) {
      setStatus("Failed to delete note.");
      return;
    }

    setAnnotations((prev) => prev.filter((item) => item.id !== id));
    setStatus("Note deleted.");
  }

  function startEditAnnotation(annotation) {
    setEditingId(annotation.id);
    setEditingLabel(annotation.label || "");
    setEditingNote(annotation.note || "");
    setEditingCardFront(annotation.cardFront || "");
    setEditingCardBack(annotation.cardBack || "");
    setEditingNoteType(annotation.noteType || "normal");
  }

  function cancelEditAnnotation() {
    setEditingId(null);
    setEditingLabel("");
    setEditingNote("");
    setEditingCardFront("");
    setEditingCardBack("");
    setEditingNoteType("normal")
  }

  async function saveEditedAnnotation(id) {
    const finalLabel = editingLabel.trim() || "Unlabeled";
    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("annotations")
      .update({
        label: finalLabel,
        note: editingNoteType === "normal" ? editingNote.trim() : "",
        note_type: editingNoteType,
        card_front: editingNoteType === "flashcard" ? editingCardFront.trim() : "",
        card_back: editingNoteType === "flashcard" ? editingCardBack.trim() : "",
        updated_at: updatedAt,
      })
      .eq("id", id);

    if (error) {
      setStatus("Failed to update note.");
      return;
    }

    setAnnotations((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              label: finalLabel,
              noteType: editingNoteType,
              note: editingNoteType === "normal" ? editingNote.trim() : "",
              cardFront: editingNoteType === "flashcard" ? editingCardFront.trim() : "",
              cardBack: editingNoteType === "flashcard" ? editingCardBack.trim() : "",
              updatedAt,
            }
          : item
      )
    );

    setCustomLabels((prev) => {
      if (prev.includes(finalLabel)) return prev;
      return [finalLabel, ...prev];
    });

    cancelEditAnnotation();
    setStatus("Note updated.");
  }


  async function renameLabelEverywhere(oldLabel, newLabel) {
    const cleanOldLabel = oldLabel.trim();
    const cleanNewLabel = newLabel.trim();

    if (!cleanOldLabel || !cleanNewLabel || cleanOldLabel === cleanNewLabel) {
      return;
    }

    const { error } = await supabase
      .from("annotations")
      .update({ label: cleanNewLabel })
      .eq("user_id", user.id)
      .eq("label", cleanOldLabel);

    if (error) {
      setStatus("Failed to rename label.");
      return;
    }

    setAnnotations((prev) =>
      prev.map((item) =>
        item.label === cleanOldLabel
          ? { ...item, label: cleanNewLabel }
          : item
      )
    );

    setCustomLabels((prev) =>
      [...new Set(prev.map((label) => (label === cleanOldLabel ? cleanNewLabel : label)))]
    );

    setLabelColors((prev) => {
      const next = { ...prev };

      if (next[cleanOldLabel] && !next[cleanNewLabel]) {
        next[cleanNewLabel] = next[cleanOldLabel];
      }

      delete next[cleanOldLabel];

      return next;
    });

    if (labelText === cleanOldLabel) {
      setLabelText(cleanNewLabel);
    }

    setStatus(`Label renamed to ${cleanNewLabel}.`);
  }

  async function deleteLabelEverywhere(labelToDelete) {
    const cleanLabel = labelToDelete.trim();

    if (!cleanLabel) return;

    const confirmed = window.confirm(
      `Delete label "${cleanLabel}"? Existing notes with this label will become "Unlabeled".`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("annotations")
      .update({ label: "Unlabeled" })
      .eq("user_id", user.id)
      .eq("label", cleanLabel);

    if (error) {
      setStatus("Failed to delete label.");
      return;
    }

    setAnnotations((prev) =>
      prev.map((item) =>
        item.label === cleanLabel ? { ...item, label: "Unlabeled" } : item
      )
    );

    setCustomLabels((prev) => prev.filter((label) => label !== cleanLabel));

    setLabelColors((prev) => {
      const next = { ...prev };
      delete next[cleanLabel];
      return next;
    });

    if (labelText === cleanLabel) {
      setLabelText("");
    }

    setStatus(`Label "${cleanLabel}" deleted.`);
  }

  async function jumpToAnnotation(annotation) {
    const matchingPdf = pdfLibrary.find(
      (item) => item.fileName === annotation.pdfName
    );

    if (!annotation.rect) {
      setStatus("This note has no saved source position.");
      return;
    }

    setSourceAnnotationId(annotation.id);

    if (!pdfDoc || pdfName !== annotation.pdfName) {
      if (!matchingPdf) {
        setStatus("This note's source PDF is not in your PDF Codex yet.");
        setView("reader");
        return;
      }

      await openPdfFromLibrary(matchingPdf, annotation.pageNumber);
    } else {
      setView("reader");
      setCurrentPage(annotation.pageNumber);
      resetSelectionState();
      await renderPage(pdfDoc, annotation.pageNumber, scale);
      await rememberCurrentPdfPage(annotation.pageNumber);
    }

    setTimeout(() => {
      const pageElement = pageRef.current;
      const pdfArea = pageElement?.closest(".pdf-area");

      if (!pageElement || !pdfArea) return;

      const targetTop =
        annotation.rect.y * pageElement.offsetHeight -
        pdfArea.clientHeight / 2;

      pdfArea.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    }, 250);
  }

  async function deletePdfDocument(pdfItem) {
    const confirmed = window.confirm(
      `Delete ${pdfItem.fileName} from your PDF Codex? Existing notes will remain.`
    );

    if (!confirmed) return;

    const { error: storageError } = await supabase.storage
      .from(PDF_BUCKET)
      .remove([pdfItem.storagePath]);

    if (storageError) {
      setStatus("Failed to delete PDF file from storage.");
      return;
    }

    const { error: dbError } = await supabase
      .from("pdf_documents")
      .delete()
      .eq("id", pdfItem.id)
      .eq("user_id", user.id);

    if (dbError) {
      setStatus("Failed to delete PDF metadata.");
      return;
    }

    setPdfLibrary((prev) => prev.filter((item) => item.id !== pdfItem.id));

    if (activePdfId === pdfItem.id) {
      setPdfDoc(null);
      setActivePdfId(null);
      setPdfName("");
      setCurrentPage(1);
      setTotalPages(0);
      setPageSize({ width: 0, height: 0 });
    }

    setStatus("PDF removed from your PDF Codex.");
  }

  function rectToStyle(rect) {
    return {
      left: rect.x * pageSize.width,
      top: rect.y * pageSize.height,
      width: rect.width * pageSize.width,
      height: rect.height * pageSize.height,
    };
  }


  const currentPageAnnotations = annotations.filter(
    (item) => item.pageNumber === currentPage && item.pdfName === pdfName
  );

  const latestNotes = [...annotations]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, latestLimit);

  function toggleFlashcard(annotationId) {
    setFlippedFlashcards((prev) => ({
      ...prev,
      [annotationId]: !prev[annotationId],
    }));
  }



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
    <HistoryPage
      annotations={annotations}
      pdfLibrary={pdfLibrary}
      historyMode={historyMode}
      setHistoryMode={setHistoryMode}
      setView={setView}
      signOut={signOut}
      openPdfFromLibrary={openPdfFromLibrary}
      deletePdfDocument={deletePdfDocument}
      flippedFlashcards={flippedFlashcards}
      toggleFlashcard={toggleFlashcard}
      jumpToAnnotation={jumpToAnnotation}
      labelColors={labelColors}

      editingId={editingId}
      editingLabel={editingLabel}
      setEditingLabel={setEditingLabel}
      editingNote={editingNote}
      setEditingNote={setEditingNote}
      editingCardFront={editingCardFront}
      setEditingCardFront={setEditingCardFront}
      editingCardBack={editingCardBack}
      setEditingCardBack={setEditingCardBack}

      editingNoteType={editingNoteType}
      setEditingNoteType={setEditingNoteType}

      customLabels={customLabels}

      saveEditedAnnotation={saveEditedAnnotation}
      cancelEditAnnotation={cancelEditAnnotation}
      startEditAnnotation={startEditAnnotation}
      deleteAnnotation={deleteAnnotation}
    />
  );
}

  if (view === "settings") {
    return (
      <SettingsPanel
        customLabels={customLabels}
        labelColors={labelColors}
        setLabelColors={setLabelColors}
        renameLabelEverywhere={renameLabelEverywhere}
        deleteLabelEverywhere={deleteLabelEverywhere}
        agentPromptLabels={agentPromptLabels}
        setAgentPromptLabels={setAgentPromptLabels}
        setView={setView}
        signOut={signOut}
      />
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

          <button className="nav-link" onClick={() => setView("history")}>
            Note History
          </button>

          <button className="nav-link signout-link" onClick={signOut}>
            Sign Out
          </button>
        </nav>
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

              <div className="viewer-header-actions">
                <button
                  type="button"
                  className="view-saved-pdf-button"
                  onClick={() => setSavedPdfModalOpen(true)}
                >
                  View Saved PDF
                </button>

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
                <div ref={textLayerRef} className="pdf-text-layer" />

                <div className="highlight-layer">
                  {currentPageAnnotations
                    .filter((annotation) => annotation.rect)
                    .map((annotation) => (
                      <div
                        key={annotation.id}
                        className={
                          annotation.id === sourceAnnotationId
                            ? "highlight source-highlight"
                            : "highlight saved-highlight"
                        }
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

                  {nativeSelectionRects.map((rect, index) => (
                    <div
                      key={`native-selection-${index}`}
                      className="highlight native-selection-highlight"
                      style={{
                        left: rect.x,
                        top: rect.y,
                        width: rect.width,
                        height: rect.height,
                      }}
                    />
                  ))}
                </div>

                {selectionToolbar && (
                  <button
                    className="selection-toolbar"
                    style={{
                      left: selectionToolbar.x,
                      top: selectionToolbar.y,
                    }}
                    onClick={handleFloatingExtractText}
                  >
                    {selectionToolbar.type === "native" ? "Add Note" : "Extract Text"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="right-panel">
          <section className="note-editor-card">
            <div className="note-editor-title-row">
              <h2>Add Note</h2>

              <button
                type="button"
                className="ask-ai-button fancy-ai-button"
                onClick={() => setAgentOpen(true)}
              >
                <span className="ai-bot-icon">🤖</span>
                <span>Ask AI</span>
                <span className="ai-sparkle">✦</span>
              </button>
            </div>

            {extractError && <p className="error-text">{extractError}</p>}

            {extractedText && (
              <div className="ocr-result-card">
                <div className="ocr-header-row">
                  <h3>Extracted Text</h3>

                  <div className="ocr-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={copyExtractedText}
                      aria-label="Copy extracted text"
                      title="Copy"
                    >
                      ⧉
                    </button>
                  </div>
                </div>

                <textarea
                  className="extracted-text-editor"
                  value={extractedText}
                  onChange={(event) => setExtractedText(event.target.value)}
                  placeholder="Edit extracted text..."
                />
              </div>
            )}

            <div className="note-type-switch">
              <button
                type="button"
                className={noteType === "normal" ? "active" : ""}
                onClick={() => setNoteType("normal")}
              >
                Normal Note
              </button>

              <button
                type="button"
                className={noteType === "flashcard" ? "active" : ""}
                onClick={() => setNoteType("flashcard")}
              >
                Flashcard
              </button>
            </div>

            {noteType === "flashcard" ? (
              <div className="flashcard-editor">
                <input
                  className="label-input"
                  value={cardFront}
                  onChange={(event) => setCardFront(event.target.value)}
                  placeholder="Front side, e.g. 능력"
                />

                <textarea
                  value={cardBack}
                  onChange={(event) => setCardBack(event.target.value)}
                  placeholder="Back side, e.g. 能力 / ability"
                />
              </div>
            ) : (
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Write your note..."
              />
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
                    style={{ "--label-color": labelColors[label] || "#64748b" }}
                    onClick={() => setLabelText(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={saveAnnotation}>Save Note</button>
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

            <label className="compact-control">
              See recent 
              <input
                type="number"
                min="1"
                max={annotations.length || 1}
                value={latestLimit}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!value) {
                    setLatestLimit(1);
                    return;
                  }

                  setLatestLimit(Math.max(1, Math.min(value, annotations.length || 1)));
                }}
              />
              records
            </label>

            <div className="notes-list">
              {latestNotes.length === 0 && (
                <div className="empty-card">No notes yet.</div>
              )}

              {latestNotes.map((annotation) => (
                <NoteCard
                  key={annotation.id}
                  annotation={annotation}
                  onDelete={deleteAnnotation}
                  flippedFlashcards={flippedFlashcards}
                  toggleFlashcard={toggleFlashcard}
                  jumpToAnnotation={jumpToAnnotation}
                  labelColors={labelColors}
                />
              ))}
            </div>
          </section>
        </aside>
      </main>
      {savedPdfModalOpen && (
        <div className="saved-pdf-modal-overlay">
          <div className="saved-pdf-modal">
            <div className="saved-pdf-modal-header">
              <div>
                <h2>Saved PDFs</h2>
                <p>{pdfLibrary.length} PDFs</p>
              </div>

              <button
                type="button"
                className="saved-pdf-close-button"
                onClick={() => setSavedPdfModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="saved-pdf-modal-list">
              {pdfLibrary.length === 0 ? (
                <div className="saved-pdf-empty">
                  No saved PDFs yet.
                </div>
              ) : (
                pdfLibrary.map((pdfItem) => (
                  <div className="saved-pdf-modal-item" key={pdfItem.id}>
                    <div className="saved-pdf-modal-name">
                      {pdfItem.fileName}
                    </div>

                    <div className="saved-pdf-modal-actions">
                      <button
                        type="button"
                        className="saved-pdf-open-button"
                        onClick={async () => {
                          await openPdfFromLibrary(pdfItem);
                          setSavedPdfModalOpen(false);
                        }}
                      >
                        Open
                      </button>

                      <button
                        type="button"
                        className="saved-pdf-delete-button"
                        onClick={() => deletePdfDocument(pdfItem)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <CatAgentChat
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        extractedText={extractedText}
        setExtractedText={setExtractedText}
        agentPromptLabels={agentPromptLabels}
      />
    </div>
  );
}
