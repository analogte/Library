"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, FileText } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface SearchResult {
  page: number;
  snippet: string;
  matchIndex: number;
}

interface BookSearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfDocument: PDFDocumentProxy | null;
  onNavigate: (page: number) => void;
}

// Max context chars around match for snippet
const SNIPPET_CONTEXT = 60;

export function BookSearchPanel({
  open,
  onOpenChange,
  pdfDocument,
  onNavigate,
}: BookSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);

  // Page text cache: page number -> extracted text
  const textCacheRef = useRef<Map<number, string>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  // Clear cache when PDF document changes
  useEffect(() => {
    textCacheRef.current.clear();
  }, [pdfDocument]);

  // Extract text from a single page (with caching)
  const getPageText = useCallback(
    async (pageNum: number): Promise<string> => {
      const cached = textCacheRef.current.get(pageNum);
      if (cached !== undefined) return cached;

      if (!pdfDocument) return "";

      const page = await pdfDocument.getPage(pageNum);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");

      textCacheRef.current.set(pageNum, text);
      return text;
    },
    [pdfDocument]
  );

  // Build snippet around match with context
  const buildSnippet = (text: string, matchStart: number, queryLen: number): string => {
    const start = Math.max(0, matchStart - SNIPPET_CONTEXT);
    const end = Math.min(text.length, matchStart + queryLen + SNIPPET_CONTEXT);

    let snippet = "";
    if (start > 0) snippet += "...";
    snippet += text.slice(start, end);
    if (end < text.length) snippet += "...";

    return snippet;
  };

  // Perform search across all pages
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!pdfDocument || !searchQuery.trim()) {
        setResults([]);
        setSearchDone(false);
        setSearching(false);
        return;
      }

      abortRef.current = false;
      setSearching(true);
      setSearchDone(false);
      setResults([]);

      const normalizedQuery = searchQuery.toLowerCase().trim();
      const allResults: SearchResult[] = [];
      let matchCounter = 0;

      for (let i = 1; i <= pdfDocument.numPages; i++) {
        if (abortRef.current) break;

        try {
          const text = await getPageText(i);
          const lowerText = text.toLowerCase();

          let searchPos = 0;
          while (true) {
            const idx = lowerText.indexOf(normalizedQuery, searchPos);
            if (idx === -1) break;

            allResults.push({
              page: i,
              snippet: buildSnippet(text, idx, normalizedQuery.length),
              matchIndex: matchCounter++,
            });

            searchPos = idx + 1;
          }
        } catch {
          // Skip pages that fail to extract text
        }
      }

      if (!abortRef.current) {
        setResults(allResults);
        setSearchDone(true);
        setSearching(false);
      }
    },
    [pdfDocument, getPageText]
  );

  // Debounced search trigger
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);

      // Abort current search
      abortRef.current = true;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!value.trim()) {
        setResults([]);
        setSearchDone(false);
        setSearching(false);
        return;
      }

      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    },
    [performSearch]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Handle clicking a result
  const handleResultClick = (page: number) => {
    onNavigate(page);
    onOpenChange(false);
  };

  // Highlight match in snippet
  const renderHighlightedSnippet = (snippet: string, searchQuery: string) => {
    if (!searchQuery.trim()) return snippet;

    const normalizedQuery = searchQuery.toLowerCase().trim();
    const lowerSnippet = snippet.toLowerCase();
    const parts: { text: string; highlighted: boolean }[] = [];

    let lastIndex = 0;
    let searchPos = 0;

    while (true) {
      const idx = lowerSnippet.indexOf(normalizedQuery, searchPos);
      if (idx === -1) break;

      // Add non-highlighted part before match
      if (idx > lastIndex) {
        parts.push({ text: snippet.slice(lastIndex, idx), highlighted: false });
      }

      // Add highlighted match (use original case from snippet)
      parts.push({
        text: snippet.slice(idx, idx + normalizedQuery.length),
        highlighted: true,
      });

      lastIndex = idx + normalizedQuery.length;
      searchPos = idx + 1;
    }

    // Add remaining text
    if (lastIndex < snippet.length) {
      parts.push({ text: snippet.slice(lastIndex), highlighted: false });
    }

    return (
      <>
        {parts.map((part, i) =>
          part.highlighted ? (
            <mark
              key={i}
              className="rounded-sm bg-yellow-200 px-0.5 text-yellow-900 dark:bg-yellow-400/30 dark:text-yellow-200"
            >
              {part.text}
            </mark>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="flex max-h-[70vh] flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            ค้นหาในหนังสือ
          </SheetTitle>
          <SheetDescription className="sr-only">
            ค้นหาข้อความในหนังสือ PDF ทุกหน้า
          </SheetDescription>
        </SheetHeader>

        {/* Search input */}
        <div className="flex-shrink-0 px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="พิมพ์คำที่ต้องการค้นหา..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Search status */}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {searching && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>กำลังค้นหา...</span>
              </>
            )}
            {!searching && searchDone && (
              <span>
                พบ {results.length} ผลลัพธ์
                {results.length > 0 && (
                  <>
                    {" "}ใน{" "}
                    {new Set(results.map((r) => r.page)).size} หน้า
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {results.length === 0 && searchDone && query.trim() && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm">ไม่พบผลลัพธ์สำหรับ &quot;{query}&quot;</p>
            </div>
          )}

          {results.length === 0 && !searchDone && !searching && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">พิมพ์คำค้นหาเพื่อค้นหาในหนังสือ</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="flex flex-col gap-1">
              {results.map((result) => (
                <button
                  key={`${result.page}-${result.matchIndex}`}
                  onClick={() => handleResultClick(result.page)}
                  className="group flex flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <span className="text-xs font-medium text-primary">
                    หน้า {result.page}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground group-hover:text-foreground">
                    {renderHighlightedSnippet(result.snippet, query)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
