"use client";

import { useState, useCallback } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { translateText } from "@/lib/translate";

interface TranslationChunk {
  original: string;
  translated: string;
  status: "pending" | "translating" | "done" | "error";
}

interface PageTranslationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getPageText: () => Promise<string>;
}

const CHUNK_SIZE = 4500;

function splitTextIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_SIZE) {
      chunks.push(remaining);
      break;
    }
    // Try to break at sentence boundary
    let breakAt = remaining.lastIndexOf(". ", CHUNK_SIZE);
    if (breakAt < CHUNK_SIZE * 0.5) {
      breakAt = remaining.lastIndexOf(" ", CHUNK_SIZE);
    }
    if (breakAt < CHUNK_SIZE * 0.3) {
      breakAt = CHUNK_SIZE;
    }
    chunks.push(remaining.slice(0, breakAt + 1));
    remaining = remaining.slice(breakAt + 1);
  }
  return chunks;
}

export function PageTranslationPanel({
  open,
  onOpenChange,
  getPageText,
}: PageTranslationPanelProps) {
  const [chunks, setChunks] = useState<TranslationChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  const handleTranslate = useCallback(async () => {
    setLoading(true);
    setStarted(true);

    try {
      const text = await getPageText();
      if (!text.trim()) {
        setChunks([{ original: "", translated: "ไม่พบข้อความในหน้านี้", status: "error" }]);
        setLoading(false);
        return;
      }

      const textChunks = splitTextIntoChunks(text);
      const initial: TranslationChunk[] = textChunks.map((t) => ({
        original: t,
        translated: "",
        status: "pending",
      }));
      setChunks(initial);

      // Translate progressively
      for (let i = 0; i < textChunks.length; i++) {
        setChunks((prev) =>
          prev.map((c, idx) => (idx === i ? { ...c, status: "translating" } : c))
        );
        try {
          const result = await translateText(textChunks[i]);
          setChunks((prev) =>
            prev.map((c, idx) =>
              idx === i ? { ...c, translated: result.translatedText, status: "done" } : c
            )
          );
        } catch {
          setChunks((prev) =>
            prev.map((c, idx) =>
              idx === i ? { ...c, translated: "แปลไม่สำเร็จ", status: "error" } : c
            )
          );
        }
      }
    } catch {
      setChunks([{ original: "", translated: "ไม่สามารถโหลดข้อความได้", status: "error" }]);
    } finally {
      setLoading(false);
    }
  }, [getPageText]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setChunks([]);
      setStarted(false);
      setLoading(false);
    }
    onOpenChange(v);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[70vh] flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Languages className="h-4 w-4" />
            แปลทั้งหน้า
          </SheetTitle>
          <SheetDescription className="sr-only">
            แปลข้อความทั้งหน้าที่กำลังอ่าน
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!started && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Languages className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">
                กดปุ่มด้านล่างเพื่อแปลข้อความทั้งหน้า
              </p>
              <Button onClick={handleTranslate} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                เริ่มแปล
              </Button>
            </div>
          )}

          {started && chunks.length > 0 && (
            <div className="space-y-4">
              {chunks.map((chunk, i) => (
                <div key={i} className="space-y-1">
                  {chunk.original && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {chunk.original}
                    </p>
                  )}
                  {chunk.status === "translating" && (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-muted-foreground">กำลังแปล...</span>
                    </div>
                  )}
                  {(chunk.status === "done" || chunk.status === "error") && (
                    <p
                      className={`text-sm leading-relaxed font-medium ${
                        chunk.status === "error" ? "text-destructive" : ""
                      }`}
                    >
                      {chunk.translated}
                    </p>
                  )}
                  {i < chunks.length - 1 && <hr className="my-2" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
