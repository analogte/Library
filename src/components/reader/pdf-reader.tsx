"use client";

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface PdfReaderHandle {
  goToPage: (page: number) => void;
  getCurrentPage: () => number;
  getTotalPages: () => number;
}

interface PdfReaderProps {
  fileData: Blob;
  initialPage?: number;
  onPageChange?: (page: number, totalPages: number) => void;
  onTextSelect?: (text: string, rect: DOMRect) => void;
}

export const PdfReader = forwardRef<PdfReaderHandle, PdfReaderProps>(
  function PdfReader({ fileData, initialPage = 1, onPageChange, onTextSelect }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.5);
    const [loading, setLoading] = useState(true);
    const renderTaskRef = useRef<ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | null>(null);
    const pdfjsLibRef = useRef<typeof import("pdfjs-dist") | null>(null);

    useImperativeHandle(ref, () => ({
      goToPage: (page: number) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
      },
      getCurrentPage: () => currentPage,
      getTotalPages: () => totalPages,
    }));

    // Load PDF
    useEffect(() => {
      let cancelled = false;
      (async () => {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        pdfjsLibRef.current = pdfjsLib;

        const arrayBuffer = await fileData.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!cancelled) {
          setPdf(doc);
          setTotalPages(doc.numPages);
          setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [fileData]);

    // Render page
    useEffect(() => {
      if (!pdf || !canvasRef.current || !textLayerRef.current) return;

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

        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;

        try {
          await renderTask.promise;
        } catch {
          // render cancelled
          return;
        }

        // Text layer
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

        onPageChange?.(currentPage, totalPages);
      })();

      return () => { cancelled = true; };
    }, [pdf, currentPage, scale, totalPages, onPageChange]);

    // Text selection handler
    useEffect(() => {
      const handleMouseUp = () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const text = selection.toString().trim();
        if (!text) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        onTextSelect?.(text, rect);
      };

      const el = textLayerRef.current;
      el?.addEventListener("mouseup", handleMouseUp);
      return () => el?.removeEventListener("mouseup", handleMouseUp);
    }, [onTextSelect]);

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

    if (loading) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">กำลังโหลด PDF...</p>
        </div>
      );
    }

    return (
      <div ref={containerRef} className="flex h-full flex-col items-center overflow-auto bg-muted/30">
        <div className="relative my-4">
          <canvas ref={canvasRef} className="shadow-lg" />
          <div
            ref={textLayerRef}
            className="absolute inset-0"
            style={{
              opacity: 0.3,
              lineHeight: 1,
            }}
          />
        </div>

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
