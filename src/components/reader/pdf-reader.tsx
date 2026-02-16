"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useSwipe } from "@/hooks/use-swipe";
import type { ReaderSettings } from "@/lib/reader-settings";
import { BG_PRESETS } from "@/lib/reader-settings";
import type { Highlight } from "@/lib/types";

export interface PdfReaderHandle {
  goToPage: (page: number) => void;
  getCurrentPage: () => number;
  getTotalPages: () => number;
  getPdfDocument: () => PDFDocumentProxy | null;
}

interface PdfReaderProps {
  fileData: Blob;
  initialPage?: number;
  onPageChange?: (page: number, totalPages: number) => void;
  onTextSelect?: (text: string, rect: DOMRect) => void;
  readerSettings?: ReaderSettings;
  highlights?: Highlight[];
  onHighlightDelete?: (highlightId: number) => void;
}

export const PdfReader = forwardRef<PdfReaderHandle, PdfReaderProps>(
  function PdfReader({ fileData, initialPage = 1, onPageChange, onTextSelect, readerSettings, highlights, onHighlightDelete }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.5);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [highlightPopup, setHighlightPopup] = useState<{ id: number; x: number; y: number } | null>(null);
    const renderTaskRef = useRef<ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | null>(null);
    const pdfjsLibRef = useRef<typeof import("pdfjs-dist") | null>(null);
    const blobUrlRef = useRef<string | null>(null);

    // Page prefetch cache — เก็บ ImageBitmap ของหน้าที่ render แล้ว
    const PREFETCH_AHEAD = 3;
    const PREFETCH_BEHIND = 1;
    const pageCacheRef = useRef<Map<number, ImageBitmap>>(new Map());
    const cacheScaleRef = useRef(scale);
    const prefetchingRef = useRef<Set<number>>(new Set());

    useImperativeHandle(ref, () => ({
      goToPage: (page: number) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
      },
      getCurrentPage: () => currentPage,
      getTotalPages: () => totalPages,
      getPdfDocument: () => pdf,
    }));

    // Cleanup page cache on unmount
    useEffect(() => {
      return () => {
        for (const bm of pageCacheRef.current.values()) bm.close();
        pageCacheRef.current.clear();
      };
    }, []);

    // Prefetch a single page to cache (runs in background, ไม่ block UI)
    const prefetchPage = useCallback((pdfDoc: PDFDocumentProxy, pageNum: number, renderScale: number) => {
      const cache = pageCacheRef.current;
      if (cache.has(pageNum) || prefetchingRef.current.has(pageNum)) return;

      prefetchingRef.current.add(pageNum);
      (async () => {
        try {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: renderScale });

          // Render ลง hidden canvas (ไม่ใส่ DOM — ไม่มีผลกับ UI)
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = viewport.width;
          tempCanvas.height = viewport.height;
          const ctx = tempCanvas.getContext("2d");
          if (!ctx) return;

          await page.render({ canvasContext: ctx, viewport }).promise;

          // เก็บเป็น ImageBitmap (ประหยัด memory กว่าเก็บ canvas)
          if (cacheScaleRef.current === renderScale) {
            const bitmap = await createImageBitmap(tempCanvas);
            cache.set(pageNum, bitmap);
          }
        } catch {
          // prefetch failed — ไม่เป็นไร จะ render ตอนเปิดหน้าจริง
        } finally {
          prefetchingRef.current.delete(pageNum);
        }
      })();
    }, []);

    // ลบหน้าที่ห่างจาก currentPage ออกจาก cache
    const evictDistantPages = useCallback((current: number) => {
      const cache = pageCacheRef.current;
      for (const [num, bm] of cache) {
        if (Math.abs(num - current) > PREFETCH_AHEAD + 1) {
          bm.close();
          cache.delete(num);
        }
      }
    }, []);

    // Load PDF — use Blob URL for streaming (much better for large files)
    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
          pdfjsLibRef.current = pdfjsLib;

          // Use Blob URL instead of arrayBuffer — streams data, much faster for large files
          const url = URL.createObjectURL(fileData);
          blobUrlRef.current = url;

          const doc = await pdfjsLib.getDocument(url).promise;
          if (!cancelled) {
            setPdf(doc);
            setTotalPages(doc.numPages);
            setLoading(false);
          }
        } catch (err) {
          if (!cancelled) {
            console.error("PDF load error:", err);
            setError("ไม่สามารถโหลด PDF ได้");
            setLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    }, [fileData]);

    // Render page — ใช้ cache ถ้ามี, ไม่มีก็ render แล้ว cache ไว้
    useEffect(() => {
      if (!pdf || !canvasRef.current || !textLayerRef.current) return;

      // ถ้า scale เปลี่ยน → ล้าง cache ทั้งหมด (ต้อง render ใหม่ที่ขนาดใหม่)
      if (cacheScaleRef.current !== scale) {
        for (const bm of pageCacheRef.current.values()) bm.close();
        pageCacheRef.current.clear();
        cacheScaleRef.current = scale;
      }

      let cancelled = false;
      (async () => {
        // Cancel previous render
        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch {}
        }

        const page = await pdf.getPage(currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // ตรวจ cache — ถ้ามี ImageBitmap แล้ว วาดทันทีไม่ต้อง render
        const cached = pageCacheRef.current.get(currentPage);
        if (cached) {
          ctx.drawImage(cached, 0, 0);
        } else {
          // Cache miss — render ปกติ แล้วเก็บลง cache
          const renderTask = page.render({ canvasContext: ctx, viewport });
          renderTaskRef.current = renderTask;

          try {
            await renderTask.promise;
          } catch {
            return; // render cancelled
          }

          // เก็บผลลัพธ์ลง cache เป็น ImageBitmap
          if (!cancelled) {
            try {
              const bitmap = await createImageBitmap(canvas);
              pageCacheRef.current.set(currentPage, bitmap);
            } catch {}
          }
        }

        if (cancelled) return;

        // Text layer (render ทุกครั้ง — เพราะเป็น interactive element)
        const textContent = await page.getTextContent();
        if (cancelled) return;

        const textLayer = textLayerRef.current!;
        textLayer.innerHTML = "";
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;

        if (!pdfjsLibRef.current) return;
        const tl = new pdfjsLibRef.current.TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport,
        });
        await tl.render();

        // Apply saved highlights to text layer spans
        if (highlights && highlights.length > 0) {
          const pageHighlights = highlights.filter((h) => h.page === currentPage);
          if (pageHighlights.length > 0) {
            const spans = textLayer.querySelectorAll("span");
            for (const hl of pageHighlights) {
              const hlText = hl.text.toLowerCase();
              spans.forEach((span) => {
                const spanText = span.textContent?.toLowerCase() ?? "";
                if (spanText && hlText.includes(spanText) && spanText.length > 1) {
                  span.style.backgroundColor = hl.color + "66";
                  span.style.borderRadius = "2px";
                  span.setAttribute("data-highlight-id", String(hl.id));
                } else if (spanText && spanText.includes(hlText) && hlText.length > 1) {
                  span.style.backgroundColor = hl.color + "66";
                  span.style.borderRadius = "2px";
                  span.setAttribute("data-highlight-id", String(hl.id));
                }
              });
            }
          }
        }

        onPageChange?.(currentPage, totalPages);

        // Prefetch หน้าใกล้เคียง + ลบหน้าที่ไกลออกจาก cache
        evictDistantPages(currentPage);
        for (let i = 1; i <= PREFETCH_AHEAD; i++) {
          if (currentPage + i <= totalPages) prefetchPage(pdf, currentPage + i, scale);
        }
        for (let i = 1; i <= PREFETCH_BEHIND; i++) {
          if (currentPage - i >= 1) prefetchPage(pdf, currentPage - i, scale);
        }
      })();

      return () => { cancelled = true; };
    }, [pdf, currentPage, scale, totalPages, onPageChange, highlights, prefetchPage, evictDistantPages]);

    // Text selection — debounced to avoid flickering during drag
    const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleTextMouseUp = () => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const text = selection.toString().trim();
        if (!text) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        onTextSelect?.(text, rect);
      }, 250);
    };

    const handleTextMouseDown = () => {
      // Clear pending selection timer when starting new drag
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    };

    // Click on highlighted span → show delete popup
    const handleTextLayerClick = (e: React.MouseEvent) => {
      // Don't show popup if user is selecting text
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;

      const target = e.target as HTMLElement;
      const highlightId = target.getAttribute("data-highlight-id");
      if (highlightId) {
        const rect = target.getBoundingClientRect();
        setHighlightPopup({
          id: Number(highlightId),
          x: rect.left + rect.width / 2,
          y: rect.top - 8,
        });
      } else {
        setHighlightPopup(null);
      }
    };

    // Keyboard navigation
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          setCurrentPage((p) => Math.min(p + 1, totalPages));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          setCurrentPage((p) => Math.max(p - 1, 1));
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [totalPages]);

    // Swipe & tap navigation for touch devices
    const goNext = useCallback(() => {
      setCurrentPage((p) => Math.min(p + 1, totalPages));
    }, [totalPages]);

    const goPrev = useCallback(() => {
      setCurrentPage((p) => Math.max(p - 1, 1));
    }, []);

    useSwipe(containerRef, {
      onSwipeLeft: goNext,
      onSwipeRight: goPrev,
      onTapLeft: goPrev,
      onTapRight: goNext,
      threshold: 50,
    });

    if (loading) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">กำลังโหลด PDF...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <p className="text-destructive">{error}</p>
          <button onClick={() => window.location.reload()} className="text-sm underline">ลองใหม่</button>
        </div>
      );
    }

    const bgColors = readerSettings ? BG_PRESETS[readerSettings.bgPreset] : null;

    return (
      <div
        ref={containerRef}
        className="flex h-full flex-col items-center overflow-auto bg-muted/30"
        style={bgColors ? { backgroundColor: bgColors.bg, color: bgColors.text } : undefined}
      >
        <div className="relative my-4">
          <canvas ref={canvasRef} className="shadow-lg" />
          <div
            ref={textLayerRef}
            className="absolute inset-0 textLayer"
            onMouseDown={handleTextMouseDown}
            onMouseUp={handleTextMouseUp}
            onClick={handleTextLayerClick}
          />
        </div>

        {/* Highlight delete popup */}
        {highlightPopup && (
          <div
            className="fixed z-50 flex items-center gap-1 rounded-lg border bg-popover px-2 py-1.5 shadow-lg"
            style={{
              left: highlightPopup.x,
              top: highlightPopup.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <button
              className="rounded px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/10"
              onClick={() => {
                onHighlightDelete?.(highlightPopup.id);
                setHighlightPopup(null);
              }}
            >
              ลบไฮไลท์
            </button>
            <button
              className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
              onClick={() => setHighlightPopup(null)}
            >
              ยกเลิก
            </button>
          </div>
        )}

        {/* Bottom page nav */}
        <div className="sticky bottom-0 flex items-center gap-4 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-t-lg border">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage <= 1}
            className="px-2 py-1 text-sm disabled:opacity-30"
          >
            ← ก่อน
          </button>
          <span className="text-sm">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage >= totalPages}
            className="px-2 py-1 text-sm disabled:opacity-30"
          >
            ถัดไป →
          </button>
          <div className="ml-4 flex items-center gap-2">
            <button onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))} className="px-2 text-sm">
              −
            </button>
            <span className="text-xs">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.min(s + 0.25, 3))} className="px-2 text-sm">
              +
            </button>
          </div>
        </div>
      </div>
    );
  }
);
