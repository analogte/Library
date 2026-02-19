"use client";

import { useState, useCallback } from "react";
import { Languages, Loader2, BookmarkPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { translateText } from "@/lib/translate";
import { db } from "@/lib/db";
import type { Highlight } from "@/lib/types";
import { toast } from "sonner";

interface TranslatedHighlight {
  highlight: Highlight;
  translation: string;
  status: "pending" | "translating" | "done" | "error";
}

interface BatchTranslatePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlights: Highlight[];
  bookId: number;
  bookTitle: string;
}

export function BatchTranslatePanel({
  open,
  onOpenChange,
  highlights,
  bookId,
  bookTitle,
}: BatchTranslatePanelProps) {
  const [items, setItems] = useState<TranslatedHighlight[]>([]);
  const [translating, setTranslating] = useState(false);
  const [started, setStarted] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleTranslateAll = useCallback(async () => {
    setStarted(true);
    setTranslating(true);
    setSaved(false);

    const initial: TranslatedHighlight[] = highlights.map((h) => ({
      highlight: h,
      translation: "",
      status: "pending",
    }));
    setItems(initial);

    for (let i = 0; i < highlights.length; i++) {
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "translating" } : item
        )
      );

      try {
        const result = await translateText(highlights[i].text);
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, translation: result.translatedText, status: "done" } : item
          )
        );
      } catch {
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, translation: "แปลไม่สำเร็จ", status: "error" } : item
          )
        );
      }

      // Small delay between requests
      if (i < highlights.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    setTranslating(false);
  }, [highlights]);

  const handleSaveAllVocab = useCallback(async () => {
    const toSave = items.filter((item) => item.status === "done" && item.translation);
    if (toSave.length === 0) {
      toast.error("ไม่มีคำที่แปลสำเร็จ");
      return;
    }

    try {
      await db.vocabulary.bulkAdd(
        toSave.map((item) => ({
          word: item.highlight.text,
          meaning: item.translation,
          bookId,
          bookTitle,
          page: item.highlight.page,
          language: "auto",
          mastered: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );
      setSaved(true);
      toast.success(`บันทึก ${toSave.length} คำสำเร็จ`);
    } catch {
      toast.error("บันทึกคำศัพท์ล้มเหลว");
    }
  }, [items, bookId, bookTitle]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setItems([]);
      setStarted(false);
      setTranslating(false);
      setSaved(false);
    }
    onOpenChange(v);
  };

  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-80 flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Languages className="h-4 w-4" />
            แปลไฮไลท์ทั้งหมด
          </SheetTitle>
          <SheetDescription className="text-xs">
            {highlights.length} ไฮไลท์
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!started && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Languages className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-center text-sm text-muted-foreground">
                แปลข้อความที่ไฮไลท์ไว้ทั้งหมดในเล่มนี้
              </p>
              <Button onClick={handleTranslateAll} disabled={highlights.length === 0}>
                แปลทั้งหมด ({highlights.length})
              </Button>
            </div>
          )}

          {started && (
            <div className="space-y-3">
              {/* Progress */}
              {translating && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  กำลังแปล {doneCount}/{items.length}
                </div>
              )}

              {items.map((item, i) => (
                <div key={item.highlight.id ?? i} className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.highlight.text}
                  </p>
                  {item.status === "translating" && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      กำลังแปล...
                    </div>
                  )}
                  {item.status === "done" && (
                    <p className="mt-1 text-sm font-medium">{item.translation}</p>
                  )}
                  {item.status === "error" && (
                    <p className="mt-1 text-xs text-destructive">{item.translation}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: save all vocab button */}
        {started && !translating && doneCount > 0 && (
          <div className="flex-shrink-0 border-t px-4 py-3">
            <Button
              onClick={handleSaveAllVocab}
              disabled={saved}
              className="w-full"
              variant={saved ? "outline" : "default"}
            >
              {saved ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  บันทึกแล้ว
                </>
              ) : (
                <>
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                  บันทึกคำศัพท์ทั้งหมด ({doneCount})
                </>
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
