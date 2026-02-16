"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { PdfReader, type PdfReaderHandle } from "@/components/reader/pdf-reader";
import { EpubReader, type EpubReaderHandle } from "@/components/reader/epub-reader";
import { SelectionMenu } from "@/components/reader/selection-menu";
import { VocabDialog } from "@/components/reader/vocab-dialog";
import type { Book } from "@/lib/types";
import { toast } from "sonner";

export default function ReaderPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = Number(params.bookId);

  const [book, setBook] = useState<Book | null>(null);
  const [fileData, setFileData] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Reader refs
  const pdfRef = useRef<PdfReaderHandle>(null);
  const epubRef = useRef<EpubReaderHandle>(null);

  // Save progress debounce ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Load book + file + progress
  useEffect(() => {
    (async () => {
      const b = await db.books.get(bookId);
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
      if (!fileRecord) {
        toast.error("ไม่พบไฟล์หนังสือ");
        router.push("/");
        return;
      }
      setFileData(fileRecord.fileData);

      // Load progress
      const progress = await db.readingProgress.where("bookId").equals(bookId).first();
      if (progress) {
        if (b.format === "pdf") {
          setInitialPage(progress.currentPage || 1);
        } else {
          setInitialCfi(progress.lastPosition ?? "");
        }
      }

      setLoading(false);
    })();
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
      toast.success("ไฮไลท์แล้ว");
    },
    [bookId, currentPage, selectionCfiRange]
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
          />
        )}
      </div>

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
    </div>
  );
}
