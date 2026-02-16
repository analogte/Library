"use client";

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import type { Rendition, Book as EpubBook, NavItem } from "epubjs";

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
    const [error, setError] = useState<string | null>(null);
    const [currentCfi, setCurrentCfi] = useState(initialLocation ?? "");
    const [toc, setToc] = useState<{ label: string; href: string }[]>([]);
    const [showToc, setShowToc] = useState(false);
    const [percentage, setPercentage] = useState(0);
    const locationsReady = useRef(false);

    // Touch tracking for swipe gestures
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    useImperativeHandle(ref, () => ({
      goToPage: (cfi: string) => renditionRef.current?.display(cfi),
      getCurrentLocation: () => currentCfi,
      nextPage: () => renditionRef.current?.next(),
      prevPage: () => renditionRef.current?.prev(),
    }));

    // Flatten nested TOC items
    const flattenToc = useCallback((items: NavItem[]): { label: string; href: string }[] => {
      const result: { label: string; href: string }[] = [];
      for (const item of items) {
        result.push({ label: item.label.trim(), href: item.href });
        if (item.subitems && item.subitems.length > 0) {
          result.push(...flattenToc(item.subitems));
        }
      }
      return result;
    }, []);

    useEffect(() => {
      if (!viewerRef.current) return;
      let destroyed = false;

      (async () => {
        try {
          const ePubModule = await import("epubjs");
          const ePub = ePubModule.default;

          const arrayBuffer = await fileData.arrayBuffer();
          const book = ePub(arrayBuffer);
          bookRef.current = book;

          await book.ready;
          if (destroyed) return;

          const rendition = book.renderTo(viewerRef.current!, {
            width: "100%",
            height: "100%",
            spread: "none",
            flow: "paginated",
            allowScriptedContent: false,
          });
          renditionRef.current = rendition;

          // Set font size
          rendition.themes.fontSize(`${fontSize}%`);

          // Register and apply dark theme
          rendition.themes.register("custom", {
            body: {
              "font-family": '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
              "line-height": "1.6 !important",
              "word-wrap": "break-word !important",
              "overflow-wrap": "break-word !important",
            },
          });
          rendition.themes.register("dark", {
            body: {
              color: "#e5e5e5 !important",
              background: "transparent !important",
            },
            "a, a:link, a:visited": { color: "#93c5fd !important" },
            "p, span, div, h1, h2, h3, h4, h5, h6, li, td, th, blockquote": {
              color: "#e5e5e5 !important",
            },
          });

          rendition.themes.select("custom");
          if (document.documentElement.classList.contains("dark")) {
            rendition.themes.select("dark");
          }

          // Display initial location or start
          try {
            if (initialLocation) {
              await rendition.display(initialLocation);
            } else {
              await rendition.display();
            }
          } catch {
            // If initial location fails, display from beginning
            await rendition.display();
          }

          if (destroyed) return;
          setLoading(false);

          // Generate locations for percentage tracking (do this in background)
          book.locations.generate(1600).then(() => {
            if (!destroyed) {
              locationsReady.current = true;
            }
          }).catch(() => {
            // Locations generation failed - we can still read, just no accurate percentages
          });

          // Load TOC
          try {
            const nav = await book.loaded.navigation;
            setToc(flattenToc(nav.toc));
          } catch {
            // TOC loading failed - not critical
          }

          // Location change handler
          rendition.on("relocated", (location: { start: { cfi: string; percentage?: number; displayed?: { page: number; total: number } } }) => {
            const cfi = location.start.cfi;
            setCurrentCfi(cfi);

            let pct = 0;
            if (locationsReady.current && bookRef.current) {
              // Use book.locations for accurate percentage
              const currentLocation = bookRef.current.locations.percentageFromCfi(cfi);
              if (typeof currentLocation === "number" && !isNaN(currentLocation)) {
                pct = currentLocation * 100;
              }
            } else if (typeof location.start.percentage === "number") {
              pct = location.start.percentage * 100;
            }

            setPercentage(pct);
            onLocationChangeRef.current?.(cfi, pct);
          });

          // Text selection handler
          rendition.on("selected", (cfiRange: string) => {
            try {
              // @ts-expect-error - manager exists at runtime
              const contents = rendition.manager?.getContents?.();
              const content = contents?.[0];
              const win = content?.window ?? content?.document?.defaultView;
              const selection = win?.getSelection();
              if (!selection || selection.isCollapsed) return;
              const text = selection.toString().trim();
              if (!text) return;

              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();

              // Adjust rect relative to viewport (account for iframe position)
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
            } catch {
              // Selection handling failed - not critical
            }
          });

          // Keyboard navigation inside iframe
          rendition.on("keyup", (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") rendition.next();
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") rendition.prev();
          });

          // Handle touch events inside epub iframe for swipe navigation
          rendition.hooks.content.register((contents: { document: Document }) => {
            const doc = contents.document;

            doc.addEventListener("touchstart", (e: TouchEvent) => {
              const touch = e.touches[0];
              touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
            }, { passive: true });

            doc.addEventListener("touchend", (e: TouchEvent) => {
              if (!touchStartRef.current) return;
              const touch = e.changedTouches[0];
              const dx = touch.clientX - touchStartRef.current.x;
              const dy = touch.clientY - touchStartRef.current.y;
              const dt = Date.now() - touchStartRef.current.time;
              touchStartRef.current = null;

              // Must be a horizontal swipe: fast enough, horizontal > vertical, minimum distance
              if (dt < 500 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                if (dx < 0) {
                  renditionRef.current?.next();
                } else {
                  renditionRef.current?.prev();
                }
              }
            }, { passive: true });
          });
        } catch (err) {
          if (!destroyed) {
            console.error("EPUB loading error:", err);
            setError(
              err instanceof Error
                ? `ไม่สามารถเปิดไฟล์ EPUB ได้: ${err.message}`
                : "ไม่สามารถเปิดไฟล์ EPUB ได้ — ไฟล์อาจเสียหายหรือรูปแบบไม่รองรับ"
            );
            setLoading(false);
          }
        }
      })();

      return () => {
        destroyed = true;
        try {
          renditionRef.current?.destroy();
        } catch {
          // ignore cleanup errors
        }
        try {
          bookRef.current?.destroy();
        } catch {
          // ignore cleanup errors
        }
        renditionRef.current = null;
        bookRef.current = null;
        locationsReady.current = false;
      };
    }, [fileData, flattenToc]);

    // Update font size dynamically
    useEffect(() => {
      renditionRef.current?.themes.fontSize(`${fontSize}%`);
    }, [fontSize]);

    // Keyboard navigation from parent window
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

    // Touch swipe on the outer container
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      if (dt < 500 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) {
          renditionRef.current?.next();
        } else {
          renditionRef.current?.prev();
        }
      }
    }, []);

    // Error state
    if (error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-destructive">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              ลองอัปโหลดไฟล์ EPUB ใหม่อีกครั้ง
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        className="flex h-full flex-col"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">กำลังโหลด EPUB...</p>
            </div>
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

        <div
          ref={viewerRef}
          className="flex-1"
          style={{ display: loading ? "none" : "block" }}
        />

        {/* Bottom nav */}
        {!loading && (
          <div className="flex items-center justify-between bg-background/80 backdrop-blur-sm px-4 py-2 border-t">
            <button
              onClick={() => setShowToc((v) => !v)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              สารบัญ
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => renditionRef.current?.prev()}
                className="px-3 py-1 text-sm rounded hover:bg-accent"
              >
                ← ก่อน
              </button>
              <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                {Math.round(percentage)}%
              </span>
              <button
                onClick={() => renditionRef.current?.next()}
                className="px-3 py-1 text-sm rounded hover:bg-accent"
              >
                ถัดไป →
              </button>
            </div>
            <div className="w-12" /> {/* Spacer for alignment */}
          </div>
        )}
      </div>
    );
  }
);
