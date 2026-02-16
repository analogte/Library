"use client";

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { Rendition, Book as EpubBook } from "epubjs";
import type { ReaderSettings } from "@/lib/reader-settings";
import { BG_PRESETS } from "@/lib/reader-settings";
import type { Highlight } from "@/lib/types";

export interface EpubSearchResult {
  cfi: string;
  excerpt: string;
  sectionLabel?: string;
}

export interface EpubReaderHandle {
  goToPage: (cfi: string) => void;
  getCurrentLocation: () => string;
  nextPage: () => void;
  prevPage: () => void;
  searchBook: (query: string) => Promise<EpubSearchResult[]>;
}

interface EpubReaderProps {
  fileData: Blob;
  initialLocation?: string;
  onLocationChange?: (cfi: string, percentage: number) => void;
  onTextSelect?: (text: string, cfiRange: string, rect: DOMRect) => void;
  readerSettings: ReaderSettings;
  highlights?: Highlight[];
  onHighlightDelete?: (id: number) => void;
}

export const EpubReader = forwardRef<EpubReaderHandle, EpubReaderProps>(
  function EpubReader(
    {
      fileData,
      initialLocation,
      onLocationChange,
      onTextSelect,
      readerSettings,
      highlights,
      onHighlightDelete,
    },
    ref
  ) {
    const viewerRef = useRef<HTMLDivElement>(null);
    const bookRef = useRef<EpubBook | null>(null);
    const renditionRef = useRef<Rendition | null>(null);
    const onLocationChangeRef = useRef(onLocationChange);
    const onTextSelectRef = useRef(onTextSelect);
    const onHighlightDeleteRef = useRef(onHighlightDelete);
    onLocationChangeRef.current = onLocationChange;
    onTextSelectRef.current = onTextSelect;
    onHighlightDeleteRef.current = onHighlightDelete;

    const [loading, setLoading] = useState(true);
    const [currentCfi, setCurrentCfi] = useState(initialLocation ?? "");
    const [toc, setToc] = useState<{ label: string; href: string }[]>([]);
    const [showToc, setShowToc] = useState(false);

    // Highlight click popup
    const [highlightPopup, setHighlightPopup] = useState<{
      id: number;
      x: number;
      y: number;
    } | null>(null);

    // Track applied highlights (id → cfiRange)
    const appliedHighlightsRef = useRef<Map<number, string>>(new Map());
    // Track last click position from iframe for highlight popup placement
    const lastClickPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    useImperativeHandle(ref, () => ({
      goToPage: (cfi: string) => renditionRef.current?.display(cfi),
      getCurrentLocation: () => currentCfi,
      nextPage: () => renditionRef.current?.next(),
      prevPage: () => renditionRef.current?.prev(),
      searchBook: async (query: string): Promise<EpubSearchResult[]> => {
        const book = bookRef.current;
        if (!book || !query.trim()) return [];

        await book.ready;
        const results: EpubSearchResult[] = [];
        const normalizedQuery = query.toLowerCase().trim();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const spine = book.spine as any;

        // Build section-label map from TOC
        const nav = await book.loaded.navigation;
        const tocMap = new Map<string, string>();
        nav.toc.forEach((item) => {
          tocMap.set(item.href.split("#")[0], item.label.trim());
        });

        for (const section of spine.spineItems) {
          if (results.length >= 200) break;
          try {
            await section.load(book.load.bind(book));
            const found: { cfi: string; excerpt: string }[] =
              section.find(normalizedQuery);
            for (const r of found) {
              if (results.length >= 200) break;
              results.push({
                cfi: r.cfi,
                excerpt: r.excerpt,
                sectionLabel:
                  tocMap.get(section.href) || section.idref || undefined,
              });
            }
            section.unload();
          } catch {
            // Skip sections that fail to load
          }
        }

        return results;
      },
    }));

    // --- Main book initialization ---
    useEffect(() => {
      if (!viewerRef.current) return;
      let destroyed = false;

      (async () => {
        try {
          const ePubModule = await import("epubjs");
          if (destroyed) return;
          const ePub = ePubModule.default;

          const arrayBuffer = await fileData.arrayBuffer();
          if (destroyed) return;

          // Clear any leftover DOM before creating new rendition
          if (viewerRef.current) viewerRef.current.innerHTML = "";

          const book = ePub(arrayBuffer);
          bookRef.current = book;

          const rendition = book.renderTo(viewerRef.current!, {
            width: "100%",
            height: "100%",
            spread: "none",
            flow: "paginated",
          });
          renditionRef.current = rendition;

          // Apply initial theme from readerSettings
          applyTheme(rendition, readerSettings);

          // --- Navigation hooks (fires for each loaded section) ---
          rendition.hooks.content.register(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (contents: any) => {
              const doc = contents.document as Document | undefined;
              if (!doc) return;

              // -- Mouse wheel navigation (with cooldown) --
              let wheelCooldown = false;
              doc.addEventListener(
                "wheel",
                (e: WheelEvent) => {
                  if (wheelCooldown) return;
                  wheelCooldown = true;
                  setTimeout(() => { wheelCooldown = false; }, 400);

                  if (e.deltaY > 0 || e.deltaX > 0) {
                    renditionRef.current?.next();
                  } else if (e.deltaY < 0 || e.deltaX < 0) {
                    renditionRef.current?.prev();
                  }
                },
                { passive: true }
              );

              // -- Track mouse position for highlight popup --
              doc.addEventListener(
                "mousedown",
                (e: MouseEvent) => {
                  const iframe =
                    viewerRef.current?.querySelector("iframe");
                  if (iframe) {
                    const ir = iframe.getBoundingClientRect();
                    lastClickPosRef.current = {
                      x: e.clientX + ir.x,
                      y: e.clientY + ir.y,
                    };
                  }
                },
                true
              );

              // -- Touch swipe (velocity-based like epub.js Snap) --
              let startX = 0;
              let startY = 0;
              let startTime = 0;

              doc.addEventListener(
                "touchstart",
                (e: TouchEvent) => {
                  const t = e.changedTouches[0];
                  startX = t.screenX;
                  startY = t.screenY;
                  startTime = Date.now();

                  // Track for highlight popup
                  const iframe =
                    viewerRef.current?.querySelector("iframe");
                  if (iframe) {
                    const ir = iframe.getBoundingClientRect();
                    lastClickPosRef.current = {
                      x: t.clientX + ir.x,
                      y: t.clientY + ir.y,
                    };
                  }
                },
                { passive: true }
              );

              doc.addEventListener(
                "touchend",
                (e: TouchEvent) => {
                  const t = e.changedTouches[0];
                  const dx = t.screenX - startX;
                  const dy = t.screenY - startY;
                  const dt = Date.now() - startTime;

                  // Don't navigate if text is selected
                  const sel = doc.getSelection?.();
                  if (sel && !sel.isCollapsed) return;

                  const absDX = Math.abs(dx);
                  const absDY = Math.abs(dy);

                  // Velocity-based swipe (min 10px, must be horizontal)
                  if (absDX > 10 && absDX > absDY) {
                    const velocity = dx / Math.max(dt, 1);
                    if (velocity < -0.2) {
                      renditionRef.current?.next();
                      return;
                    }
                    if (velocity > 0.2) {
                      renditionRef.current?.prev();
                      return;
                    }
                  }

                  // Tap at edges (< 300ms, < 10px movement)
                  if (dt < 300 && absDX < 10 && absDY < 10) {
                    const w = doc.documentElement.clientWidth;
                    const x = t.clientX;
                    if (x < w * 0.25) renditionRef.current?.prev();
                    else if (x > w * 0.75) renditionRef.current?.next();
                  }
                },
                { passive: true }
              );
            }
          );

          // Display — fallback to first page if saved location fails
          try {
            if (initialLocation) {
              await rendition.display(initialLocation);
            } else {
              await rendition.display();
            }
          } catch {
            console.warn(
              "EPUB: saved location invalid, displaying from start"
            );
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
          rendition.on(
            "relocated",
            (location: {
              start: { cfi: string; percentage: number };
            }) => {
              const cfi = location.start.cfi;
              const pct = location.start.percentage * 100;
              setCurrentCfi(cfi);
              onLocationChangeRef.current?.(cfi, pct);
            }
          );

          // Text selection — use `contents` param (like epub.js examples)
          // so we always get the right iframe window
          rendition.on(
            "selected",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (cfiRange: string, contents: any) => {
              const win = contents?.window;
              const selection = win?.getSelection?.();
              if (!selection || selection.isCollapsed) return;
              const text = selection.toString().trim();
              if (!text) return;

              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              const iframe =
                viewerRef.current?.querySelector("iframe");
              if (iframe) {
                const iframeRect =
                  iframe.getBoundingClientRect();
                const adjustedRect = new DOMRect(
                  rect.x + iframeRect.x,
                  rect.y + iframeRect.y,
                  rect.width,
                  rect.height
                );
                onTextSelectRef.current?.(
                  text,
                  cfiRange,
                  adjustedRect
                );
              } else {
                onTextSelectRef.current?.(text, cfiRange, rect);
              }
            }
          );

          // Keyboard nav inside iframe
          rendition.on("keyup", (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown")
              rendition.next();
            if (e.key === "ArrowLeft" || e.key === "ArrowUp")
              rendition.prev();
          });
        } catch (err) {
          console.error("EPUB load error:", err);
          if (!destroyed) setLoading(false);
        }
      })();

      return () => {
        destroyed = true;
        appliedHighlightsRef.current.clear();
        renditionRef.current?.destroy();
        renditionRef.current = null;
        bookRef.current?.destroy();
        bookRef.current = null;
        // Clean leftover DOM from epub.js (fixes React StrictMode double-mount)
        if (viewerRef.current) {
          viewerRef.current.innerHTML = "";
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileData]);

    // Resize rendition when viewer dimensions change
    useEffect(() => {
      const el = viewerRef.current;
      if (!el) return;
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !renditionRef.current) return;
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          renditionRef.current?.resize?.(width, height);
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // Apply reader settings (theme + font size + line height)
    useEffect(() => {
      const rendition = renditionRef.current;
      if (!rendition) return;
      applyTheme(rendition, readerSettings);
    }, [readerSettings]);

    // Apply / remove highlights via annotations API
    useEffect(() => {
      const rendition = renditionRef.current;
      if (!rendition || !highlights) return;

      const current = appliedHighlightsRef.current;
      const desired = new Map<number, string>();

      for (const h of highlights) {
        if (h.id != null && h.cfiRange) {
          desired.set(h.id, h.cfiRange);
        }
      }

      // Remove old
      for (const [id, cfi] of current) {
        if (!desired.has(id)) {
          try {
            rendition.annotations.remove(cfi, "highlight");
          } catch {
            /* ignore */
          }
          current.delete(id);
        }
      }

      // Add new
      for (const [id, cfi] of desired) {
        if (!current.has(id)) {
          try {
            rendition.annotations.add(
              "highlight",
              cfi,
              { id },
              () => {
                setHighlightPopup({
                  id,
                  x: lastClickPosRef.current.x,
                  y: lastClickPosRef.current.y,
                });
              },
              "epub-highlight",
              {
                fill: "#fbbf24",
                "fill-opacity": "0.3",
                "mix-blend-mode": "multiply",
              }
            );
            current.set(id, cfi);
          } catch {
            /* CFI may belong to a different section */
          }
        }
      }
    }, [highlights]);

    // Dismiss highlight popup on outside click
    useEffect(() => {
      if (!highlightPopup) return;
      const dismiss = () => setHighlightPopup(null);
      window.addEventListener("click", dismiss);
      return () => window.removeEventListener("click", dismiss);
    }, [highlightPopup]);

    // Mouse wheel navigation on parent container
    useEffect(() => {
      const el = viewerRef.current;
      if (!el) return;
      let cooldown = false;
      const handleWheel = (e: WheelEvent) => {
        if (cooldown) return;
        cooldown = true;
        setTimeout(() => { cooldown = false; }, 400);
        if (e.deltaY > 0 || e.deltaX > 0) {
          renditionRef.current?.next();
        } else if (e.deltaY < 0 || e.deltaX < 0) {
          renditionRef.current?.prev();
        }
      };
      el.addEventListener("wheel", handleWheel, { passive: true });
      return () => el.removeEventListener("wheel", handleWheel);
    }, []);

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

    const preset = BG_PRESETS[readerSettings.bgPreset];

    return (
      <div
        className="relative flex h-full flex-col"
        style={{ backgroundColor: preset.bg }}
      >
        {/* Loading overlay */}
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ backgroundColor: preset.bg }}
          >
            <p className="text-muted-foreground">
              กำลังโหลด EPUB...
            </p>
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

        {/* Viewer — must always render so epubjs can calculate sizes */}
        <div
          ref={viewerRef}
          className="flex-1 min-h-0 overflow-hidden"
        />

        {/* Bottom nav */}
        <div
          className="flex flex-shrink-0 items-center justify-center gap-4 px-4 py-2 border-t"
          style={{ backgroundColor: preset.bg, color: preset.text }}
        >
          <button
            onClick={() => setShowToc((v) => !v)}
            disabled={loading}
            className="text-sm opacity-70 hover:opacity-100 disabled:opacity-30"
          >
            สารบัญ
          </button>
          <button
            onClick={() => renditionRef.current?.prev()}
            disabled={loading}
            className="px-2 py-1 text-sm disabled:opacity-30"
          >
            &#8592; ก่อน
          </button>
          <button
            onClick={() => renditionRef.current?.next()}
            disabled={loading}
            className="px-2 py-1 text-sm disabled:opacity-30"
          >
            ถัดไป &#8594;
          </button>
        </div>

        {/* Highlight delete popup */}
        {highlightPopup && (
          <div
            className="fixed z-50 flex gap-1 rounded-lg border bg-card p-2 shadow-lg"
            style={{
              left: Math.min(
                highlightPopup.x,
                window.innerWidth - 180
              ),
              top: Math.max(highlightPopup.y - 50, 8),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onHighlightDeleteRef.current?.(highlightPopup.id);
                setHighlightPopup(null);
              }}
              className="rounded px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              ลบไฮไลท์
            </button>
            <button
              onClick={() => setHighlightPopup(null)}
              className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
            >
              ยกเลิก
            </button>
          </div>
        )}
      </div>
    );
  }
);

/** Apply theme + font size to rendition based on ReaderSettings */
function applyTheme(rendition: Rendition, settings: ReaderSettings) {
  const preset = BG_PRESETS[settings.bgPreset];
  const fontPct = Math.round((settings.fontSize / 16) * 100);

  rendition.themes.register("custom", {
    body: {
      background: `${preset.bg} !important`,
      color: `${preset.text} !important`,
      "line-height": `${settings.lineHeight} !important`,
    },
    "p, div, span, li, td, th, blockquote, figcaption, cite, em, strong, a, h1, h2, h3, h4, h5, h6":
      {
        color: `${preset.text} !important`,
        "line-height": `${settings.lineHeight} !important`,
      },
    "a, a:link, a:visited": {
      color:
        settings.bgPreset === "dark"
          ? "#93c5fd !important"
          : `${preset.text} !important`,
    },
  });
  rendition.themes.select("custom");
  rendition.themes.fontSize(`${fontPct}%`);
}
