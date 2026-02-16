"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { PdfReader, type PdfReaderHandle } from "@/components/reader/pdf-reader";
import { EpubReader, type EpubReaderHandle } from "@/components/reader/epub-reader";
import { SelectionMenu } from "@/components/reader/selection-menu";
import { VocabDialog } from "@/components/reader/vocab-dialog";
import { AiAssistant } from "@/components/reader/ai-assistant";
import { ReaderSettingsPanel } from "@/components/reader/reader-settings-panel";
import { BookSearchPanel } from "@/components/reader/book-search-panel";
import type { Book } from "@/lib/types";
import type { ReaderSettings } from "@/lib/reader-settings";
import { getReaderSettings, DEFAULTS } from "@/lib/reader-settings";
import { toast } from "sonner";

export default function ReaderPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = Number(params.bookId);

  const [book, setBook] = useState<Book | null>(null);
  const [fileData, setFileData] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialPage, setInitialPage] = useState(1);
  const [initialCfi, setInitialCfi] = useState("");

  // Selection state
  const [selectedText, setSelectedText] = useState("");
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [selectionCfiRange, setSelectionCfiRange] = useState<string>("");

  // Vocab dialog
  const [vocabOpen, setVocabOpen] = useState(false);
  const [vocabWord, setVocabWord] = useState("");
  const [vocabMeaning, setVocabMeaning] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // AI Assistant
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");

  // Reader settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>({ ...DEFAULTS });

  // Book search
  const [searchOpen, setSearchOpen] = useState(false);

  // Load highlights for this book (reactive — updates when new highlights are added)
  const highlights = useLiveQuery(
    () => db.highlights.where("bookId").equals(bookId).toArray(),
    [bookId]
  );

  // Reader refs
  const pdfRef = useRef<PdfReaderHandle>(null);
  const epubRef = useRef<EpubReaderHandle>(null);

  // Save progress debounce ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reading session tracking
  const sessionStartRef = useRef<Date | null>(null);

  // Start reading session on mount, save on unmount
  useEffect(() => {
    sessionStartRef.current = new Date();

    const saveSession = () => {
      const startedAt = sessionStartRef.current;
      if (!startedAt) return;
      const endedAt = new Date();
      const durationMs = endedAt.getTime() - startedAt.getTime();
      const durationMinutes = durationMs / 60000;

      // Ignore sessions shorter than 30 seconds
      if (durationMs < 30000) return;

      // Use sendBeacon with a workaround: save directly to IndexedDB
      // Since we're in cleanup, we do a fire-and-forget add
      db.readingSessions.add({
        bookId,
        startedAt,
        endedAt,
        durationMinutes: Math.round(durationMinutes * 100) / 100,
      });
    };

    // Handle page visibility change (tab switch, minimize)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveSession();
        sessionStartRef.current = null;
      } else if (document.visibilityState === "visible") {
        sessionStartRef.current = new Date();
      }
    };

    // Handle beforeunload (page close/refresh)
    const handleBeforeUnload = () => {
      saveSession();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      saveSession();
    };
  }, [bookId]);

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Load reader settings from IndexedDB
  useEffect(() => {
    getReaderSettings().then(setReaderSettings);
  }, []);

  // Load book + file + progress
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await db.books.get(bookId);
        if (cancelled) return;
        if (!b) {
          toast.error("ไม่พบหนังสือ");
          router.push("/");
          return;
        }
        setBook(b);

        // Mark as reading
        if (b.status === "unread") {
          await db.books.update(bookId, { status: "reading", updatedAt: new Date() });
        }

        const fileRecord = await db.bookFiles.where("bookId").equals(bookId).first();
        if (cancelled) return;
        if (!fileRecord) {
          toast.error("ไม่พบไฟล์หนังสือ");
          router.push("/");
          return;
        }
        setFileData(fileRecord.fileData);

        // Load progress
        const progress = await db.readingProgress.where("bookId").equals(bookId).first();
        if (cancelled) return;
        if (progress) {
          if (b.format === "pdf") {
            setInitialPage(progress.currentPage || 1);
          } else {
            setInitialCfi(progress.lastPosition ?? "");
          }
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load book:", err);
          setError("ไม่สามารถโหลดหนังสือได้ ลองรีเฟรชหน้า");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [bookId, router]);

  // Save reading progress (debounced)
  const saveProgress = useCallback(
    (page: number, totalPages: number, cfi?: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        const percentage = totalPages > 0 ? (page / totalPages) * 100 : 0;
        const existing = await db.readingProgress
          .where("bookId")
          .equals(bookId)
          .first();
        const data = {
          bookId,
          currentPage: page,
          percentage,
          lastPosition: cfi,
          updatedAt: new Date(),
        };
        if (existing) {
          await db.readingProgress.update(existing.id!, data);
        } else {
          await db.readingProgress.add(data);
        }
        // Update book timestamp
        await db.books.update(bookId, { updatedAt: new Date() });
      }, 2000);
    },
    [bookId]
  );

  // PDF page change handler
  const handlePdfPageChange = useCallback(
    (page: number, totalPages: number) => {
      setCurrentPage(page);
      saveProgress(page, totalPages);
    },
    [saveProgress]
  );

  // EPUB location change handler
  const handleEpubLocationChange = useCallback(
    (cfi: string, percentage: number) => {
      const page = Math.ceil(percentage);
      setCurrentPage(page);
      saveProgress(page, 100, cfi);
    },
    [saveProgress]
  );

  // Text selection handlers
  const handlePdfTextSelect = useCallback((text: string, rect: DOMRect) => {
    setSelectedText(text);
    setSelectionRect(rect);
    setSelectionCfiRange("");
  }, []);

  const handleEpubTextSelect = useCallback(
    (text: string, cfiRange: string, rect: DOMRect) => {
      setSelectedText(text);
      setSelectionRect(rect);
      setSelectionCfiRange(cfiRange);
    },
    []
  );

  const closeSelection = useCallback(() => {
    setSelectedText("");
    setSelectionRect(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleSaveVocab = useCallback(
    (word: string, translation: string) => {
      setVocabWord(word);
      setVocabMeaning(translation);
      setVocabOpen(true);
      closeSelection();
    },
    [closeSelection]
  );

  const handleAskAI = useCallback(() => {
    setAiText(selectedText);
    setAiOpen(true);
    closeSelection();
  }, [selectedText, closeSelection]);

  const handleHighlight = useCallback(
    async (text: string) => {
      await db.highlights.add({
        bookId,
        page: currentPage,
        text,
        color: "#fbbf24",
        cfiRange: selectionCfiRange || undefined,
        createdAt: new Date(),
      });
      closeSelection();
      toast.success("ไฮไลท์แล้ว");
    },
    [bookId, currentPage, selectionCfiRange, closeSelection]
  );

  // Delete highlight
  const handleHighlightDelete = useCallback(
    async (highlightId: number) => {
      await db.highlights.delete(highlightId);
      toast.success("ลบไฮไลท์แล้ว");
    },
    []
  );

  // Search navigation handler
  const handleSearchNavigate = useCallback(
    (page: number) => {
      pdfRef.current?.goToPage(page);
    },
    []
  );

  // Add bookmark
  const handleAddBookmark = async () => {
    const existing = await db.bookmarks
      .where("bookId")
      .equals(bookId)
      .and((b) => b.page === currentPage)
      .first();
    if (existing) {
      await db.bookmarks.delete(existing.id!);
      toast.success("ลบบุ๊กมาร์กแล้ว");
    } else {
      await db.bookmarks.add({
        bookId,
        page: currentPage,
        position: book?.format === "epub" ? epubRef.current?.getCurrentLocation() : undefined,
        color: "#f59e0b",
        createdAt: new Date(),
      });
      toast.success("บุ๊กมาร์กแล้ว");
    }
  };

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3">
        <p className="text-destructive">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/")}>กลับหน้าหลัก</Button>
          <Button onClick={() => window.location.reload()}>ลองใหม่</Button>
        </div>
      </div>
    );
  }

  if (loading || !book || !fileData) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-muted-foreground">กำลังโหลดหนังสือ...</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      {/* Reader toolbar */}
      <header className="flex h-12 flex-shrink-0 items-center gap-2 border-b bg-card px-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{book.title}</p>
        </div>
        {book.format === "pdf" && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSearchOpen(true)}>
            <Search className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleAddBookmark}>
          <Bookmark className="h-4 w-4" />
        </Button>
      </header>

      {/* Reader area */}
      <div className="relative flex-1 overflow-hidden">
        {book.format === "pdf" ? (
          <PdfReader
            ref={pdfRef}
            fileData={fileData}
            initialPage={initialPage}
            onPageChange={handlePdfPageChange}
            onTextSelect={handlePdfTextSelect}
            readerSettings={readerSettings}
            highlights={highlights}
            onHighlightDelete={handleHighlightDelete}
          />
        ) : (
          <EpubReader
            ref={epubRef}
            fileData={fileData}
            initialLocation={initialCfi}
            onLocationChange={handleEpubLocationChange}
            onTextSelect={handleEpubTextSelect}
          />
        )}

        {/* Selection floating menu */}
        {selectedText && selectionRect && (
          <SelectionMenu
            text={selectedText}
            rect={selectionRect}
            onClose={closeSelection}
            onSaveVocab={handleSaveVocab}
            onHighlight={handleHighlight}
            onAskAI={handleAskAI}
          />
        )}
      </div>

      {/* AI Assistant */}
      <AiAssistant
        selectedText={aiText}
        bookTitle={book.title}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
      />

      {/* Vocab dialog */}
      <VocabDialog
        open={vocabOpen}
        onOpenChange={setVocabOpen}
        word={vocabWord}
        meaning={vocabMeaning}
        bookId={bookId}
        bookTitle={book.title}
        page={currentPage}
      />

      {/* Reader settings panel */}
      <ReaderSettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={readerSettings}
        onSettingsChange={setReaderSettings}
      />

      {/* Book search panel (PDF only) */}
      {book.format === "pdf" && (
        <BookSearchPanel
          open={searchOpen}
          onOpenChange={setSearchOpen}
          pdfDocument={pdfRef.current?.getPdfDocument() ?? null}
          onNavigate={handleSearchNavigate}
        />
      )}
    </div>
  );
}
