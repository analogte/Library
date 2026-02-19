"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, X, Save, BookOpen } from "lucide-react";
import { generateChapterSummary, type ChapterSummary } from "@/lib/ai-summary";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";

interface AiSummaryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageText: string;
  bookTitle: string;
  bookId: number;
  currentPage: number;
}

export function AiSummaryPanel({
  open,
  onOpenChange,
  pageText,
  bookTitle,
  bookId,
  currentPage,
}: AiSummaryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ChapterSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && pageText && !summary) {
      setLoading(true);
      setError("");
      generateChapterSummary(pageText, bookTitle)
        .then(setSummary)
        .catch((err) => setError(err.message || "เกิดข้อผิดพลาด"))
        .finally(() => setLoading(false));
    }
  }, [open, pageText, bookTitle, summary]);

  // Reset on close
  const handleClose = () => {
    onOpenChange(false);
    setSummary(null);
    setError("");
  };

  const handleSaveToNotes = async () => {
    if (!summary) return;
    const content = [
      `**TL;DR:** ${summary.tldr}`,
      "",
      `**Key Concepts:** ${summary.keyConcepts.join(", ")}`,
      "",
      "**Review Questions:**",
      ...summary.reviewQuestions.map((q, i) => `${i + 1}. ${q}`),
    ].join("\n");

    await db.bookNotes.add({
      bookId,
      title: `AI สรุป — หน้า ${currentPage}`,
      content,
      page: currentPage,
      pageLabel: `หน้า ${currentPage}`,
      type: "ai-summary",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    toast.success("บันทึกลงโน้ตแล้ว");
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="flex w-80 flex-col sm:w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-purple-500" />
            AI สรุปเนื้อหา
          </SheetTitle>
          <SheetDescription className="sr-only">
            สรุปเนื้อหาจากหน้าปัจจุบันด้วย AI
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 px-4 pb-4">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">กำลังวิเคราะห์เนื้อหา...</p>
            </div>
          )}

          {error && (
            <Card className="border-destructive/50 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSummary(null);
                  setError("");
                  setLoading(true);
                  generateChapterSummary(pageText, bookTitle)
                    .then(setSummary)
                    .catch((err) => setError(err.message))
                    .finally(() => setLoading(false));
                }}
              >
                ลองใหม่
              </Button>
            </Card>
          )}

          {summary && (
            <>
              {/* TL;DR */}
              <Card className="p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <BookOpen className="h-4 w-4" />
                  TL;DR
                </h3>
                <p className="text-sm leading-relaxed">{summary.tldr}</p>
              </Card>

              {/* Key Concepts */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Key Concepts</h3>
                <div className="flex flex-wrap gap-1.5">
                  {summary.keyConcepts.map((concept, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {concept}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Review Questions */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Review Questions</h3>
                <ol className="space-y-2 text-sm">
                  {summary.reviewQuestions.map((q, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex-shrink-0 text-muted-foreground">{i + 1}.</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Save button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSaveToNotes}
              >
                <Save className="mr-2 h-4 w-4" />
                บันทึกลงโน้ต
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
