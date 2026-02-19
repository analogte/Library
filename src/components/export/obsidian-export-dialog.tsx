"use client";

import { useState, useEffect } from "react";
import { Download, Loader2, FileText, BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import {
  generateBookMarkdown,
  generateAllBooksMarkdown,
  downloadMarkdown,
} from "@/lib/obsidian-export";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Book } from "@/lib/types";

interface ObsidianExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedBookId?: number;
}

export function ObsidianExportDialog({
  open,
  onOpenChange,
  preselectedBookId,
}: ObsidianExportDialogProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (open) {
      db.books.toArray().then(setBooks);
      if (preselectedBookId) {
        setSelectedBookId(String(preselectedBookId));
      }
    }
  }, [open, preselectedBookId]);

  // Generate preview
  useEffect(() => {
    if (!open) return;
    if (selectedBookId === "all") {
      setPreview("ส่งออกทุกเล่มเป็นไฟล์ .md แยกกัน");
    } else {
      const bookId = Number(selectedBookId);
      generateBookMarkdown(bookId).then((md) => {
        setPreview(md.slice(0, 500) + (md.length > 500 ? "\n..." : ""));
      });
    }
  }, [open, selectedBookId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (selectedBookId === "all") {
        const files = await generateAllBooksMarkdown();
        for (const f of files) {
          downloadMarkdown(f.filename, f.content);
          // Small delay between downloads
          await new Promise((r) => setTimeout(r, 200));
        }
        toast.success(`ส่งออก ${files.length} ไฟล์สำเร็จ`);
      } else {
        const bookId = Number(selectedBookId);
        const book = books.find((b) => b.id === bookId);
        const content = await generateBookMarkdown(bookId);
        const safeName = (book?.title ?? "book").replace(/[/\\?%*:|"<>]/g, "-").substring(0, 100);
        downloadMarkdown(`${safeName}.md`, content);
        toast.success("ส่งออกสำเร็จ");
      }
      onOpenChange(false);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("ส่งออกล้มเหลว");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            ส่งออก Obsidian Markdown
          </DialogTitle>
          <DialogDescription>
            ส่งออกไฮไลท์ บันทึก และคำศัพท์เป็นไฟล์ .md สำหรับ Obsidian
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">เลือกหนังสือ</label>
            <Select value={selectedBookId} onValueChange={setSelectedBookId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="เลือกหนังสือ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกเล่ม ({books.length} เล่ม)</SelectItem>
                {books.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">ตัวอย่าง</label>
            <pre className="max-h-48 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">
              {preview}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            ส่งออก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
