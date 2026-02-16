"use client";

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { Rendition, Book as EpubBook } from "epubjs";

export interface EpubReaderHandle {
  goToPage: (cfi: string) => void;
  getCurrentLocation: () => string;
  nextPage: () => void;
  prevPage: () => void;
}

interface EpubReaderProps {
  fileData: Blob;
  initialLocation?: string;
  onLocationChange?: (cfi: string, percentage: number) => void;
  onTextSelect?: (text: string, cfiRange: string, rect: DOMRect) => void;
  fontSize?: number;
}

export const EpubReader = forwardRef<EpubReaderHandle, EpubReaderProps>(
  function EpubReader(
    { fileData, initialLocation, onLocationChange, onTextSelect, fontSize = 100 },
    ref
  ) {
    const viewerRef = useRef<HTMLDivElement>(null);
    const bookRef = useRef<EpubBook | null>(null);
    const renditionRef = useRef<Rendition | null>(null);
    const onLocationChangeRef = useRef(onLocationChange);
    const onTextSelectRef = useRef(onTextSelect);
    onLocationChangeRef.current = onLocationChange;
    onTextSelectRef.current = onTextSelect;
    const [loading, setLoading] = useState(true);
    const [currentCfi, setCurrentCfi] = useState(initialLocation ?? "");
    const [toc, setToc] = useState<{ label: string; href: string }[]>([]);
    const [showToc, setShowToc] = useState(false);

    useImperativeHandle(ref, () => ({
      goToPage: (cfi: string) => renditionRef.current?.display(cfi),
      getCurrentLocation: () => currentCfi,
      nextPage: () => renditionRef.current?.next(),
      prevPage: () => renditionRef.current?.prev(),
    }));

    useEffect(() => {
      if (!viewerRef.current) return;
      let destroyed = false;

      (async () => {
        const ePubModule = await import("epubjs");
        const ePub = ePubModule.default;

        const arrayBuffer = await fileData.arrayBuffer();
        const book = ePub(arrayBuffer);
        bookRef.current = book;

        const rendition = book.renderTo(viewerRef.current!, {
          width: "100%",
          height: "100%",
          spread: "none",
          flow: "paginated",
        });
        renditionRef.current = rendition;

        rendition.themes.fontSize(`${fontSize}%`);
        rendition.themes.register("dark", {
          body: {
            color: "#e5e5e5 !important",
            background: "transparent !important",
          },
          "a, a:link, a:visited": { color: "#93c5fd !important" },
        });

        // Apply dark theme if document is dark
        if (document.documentElement.classList.contains("dark")) {
          rendition.themes.select("dark");
        }

        // Display
        if (initialLocation) {
          await rendition.display(initialLocation);
        } else {
          await rendition.display();
        }

        if (destroyed) return;
        setLoading(false);

        // TOC
        const nav = await book.loaded.navigation;
        setToc(
          nav.toc.map((item) => ({
            label: item.label.trim(),
            href: item.href,
          }))
        );

        // Location change
        rendition.on("relocated", (location: { start: { cfi: string; percentage: number } }) => {
          const cfi = location.start.cfi;
          const pct = location.start.percentage * 100;
          setCurrentCfi(cfi);
          onLocationChangeRef.current?.(cfi, pct);
        });

        // Text selection
        rendition.on("selected", (cfiRange: string) => {
          // @ts-expect-error - manager exists at runtime
          const selection = rendition.manager?.getContents?.()[0]?.window?.getSelection();
          if (!selection || selection.isCollapsed) return;
          const text = selection.toString().trim();
          if (!text) return;

          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          // Adjust rect relative to viewport
          const iframe = viewerRef.current?.querySelector("iframe");
          if (iframe) {
            const iframeRect = iframe.getBoundingClientRect();
            const adjustedRect = new DOMRect(
              rect.x + iframeRect.x,
              rect.y + iframeRect.y,
              rect.width,
              rect.height
            );
            onTextSelectRef.current?.(text, cfiRange, adjustedRect);
          } else {
            onTextSelectRef.current?.(text, cfiRange, rect);
          }
        });

        // Keyboard nav
        rendition.on("keyup", (e: KeyboardEvent) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") rendition.next();
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") rendition.prev();
        });
      })();

      return () => {
        destroyed = true;
        renditionRef.current?.destroy();
        bookRef.current?.destroy();
      };
    }, [fileData]);

    // Update font size
    useEffect(() => {
      renditionRef.current?.themes.fontSize(`${fontSize}%`);
    }, [fontSize]);

    // Keyboard nav from parent window
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          renditionRef.current?.next();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          renditionRef.current?.prev();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
      <div className="relative flex h-full flex-col">
        {/* Loading overlay — ครอบ viewer ไว้แต่ไม่ซ่อน viewer เพราะ epubjs ต้องคำนวณขนาด */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <p className="text-muted-foreground">กำลังโหลด EPUB...</p>
          </div>
        )}

        {/* TOC panel */}
        {showToc && toc.length > 0 && (
          <div className="absolute inset-y-0 left-0 z-20 w-72 overflow-y-auto border-r bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">สารบัญ</h3>
              <button
                onClick={() => setShowToc(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ปิด
              </button>
            </div>
            <div className="space-y-1">
              {toc.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    renditionRef.current?.display(item.href);
                    setShowToc(false);
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Viewer ต้องแสดงตลอด — epubjs ต้องการ container ที่มีขนาดจริงตั้งแต่ renderTo */}
        <div ref={viewerRef} className="flex-1" />

        {/* Bottom nav */}
        {!loading && (
          <div className="flex items-center justify-center gap-4 bg-background/80 backdrop-blur-sm px-4 py-2 border-t">
            <button
              onClick={() => setShowToc((v) => !v)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              สารบัญ
            </button>
            <button
              onClick={() => renditionRef.current?.prev()}
              className="px-2 py-1 text-sm"
            >
              ← ก่อน
            </button>
            <button
              onClick={() => renditionRef.current?.next()}
              className="px-2 py-1 text-sm"
            >
              ถัดไป →
            </button>
          </div>
        )}
      </div>
    );
  }
);
