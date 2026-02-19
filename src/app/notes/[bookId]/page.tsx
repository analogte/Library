"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Plus,
  FileText,
  Pencil,
  Trash2,
  BookOpen,
  Download,
} from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { BookNote } from "@/lib/types";
import { generateBookMarkdown, downloadMarkdown } from "@/lib/obsidian-export";

export default function BookNotesPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = Number(params.bookId);

  const book = useLiveQuery(() => db.books.get(bookId), [bookId]);
  const notes = useLiveQuery(
    () =>
      db.bookNotes
        .where("bookId")
        .equals(bookId)
        .reverse()
        .sortBy("updatedAt"),
    [bookId]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<BookNote | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const openNewNote = () => {
    setEditingNote(null);
    setTitle("");
    setContent("");
    setDialogOpen(true);
  };

  const openEditNote = (note: BookNote) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      toast.error("กรุณาใส่หัวข้อหรือเนื้อหา");
      return;
    }

    const now = new Date();
    if (editingNote?.id) {
      await db.bookNotes.update(editingNote.id, {
        title: title.trim(),
        content: content.trim(),
        updatedAt: now,
      });
      toast.success("อัปเดตโน้ตแล้ว");
    } else {
      await db.bookNotes.add({
        bookId,
        title: title.trim(),
        content: content.trim(),
        createdAt: now,
        updatedAt: now,
      });
      toast.success("เพิ่มโน้ตแล้ว");
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: number) => {
    await db.bookNotes.delete(id);
    setDeleteConfirmId(null);
    toast.success("ลบโน้ตแล้ว");
  };

  if (book === undefined) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  if (book === null) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-destructive">ไม่พบหนังสือ</p>
        <Button variant="outline" onClick={() => router.push("/")}>
          กลับหน้าหลัก
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 mt-0.5"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <FileText className="h-6 w-6 flex-shrink-0" />
              บันทึก
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {book.title} &middot; {notes?.length ?? 0} รายการ
            </p>
          </div>
        </div>
        <Button onClick={openNewNote} className="gap-2 flex-shrink-0">
          <Plus className="h-4 w-4" />
          เพิ่มโน้ต
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => router.push(`/reader/${bookId}`)}
        >
          <BookOpen className="h-4 w-4" />
          เปิดอ่านหนังสือ
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={async () => {
            try {
              const content = await generateBookMarkdown(bookId);
              const safeName = (book?.title ?? "book").replace(/[/\\?%*:|"<>]/g, "-").substring(0, 100);
              downloadMarkdown(`${safeName}.md`, content);
              toast.success("ส่งออกสำเร็จ");
            } catch {
              toast.error("ส่งออกล้มเหลว");
            }
          }}
        >
          <Download className="h-4 w-4" />
          ส่งออก MD
        </Button>
      </div>

      {/* Notes list */}
      {notes && notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="group cursor-pointer p-4 transition-colors hover:bg-accent"
              onClick={() => openEditNote(note)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium leading-tight">
                      {note.title || "ไม่มีหัวข้อ"}
                    </h3>
                    {note.pageLabel && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                        {note.pageLabel}
                      </span>
                    )}
                  </div>
                  {note.highlightText && (
                    <p className="mt-1 text-xs text-muted-foreground/80 italic line-clamp-1 border-l-2 border-primary/30 pl-1.5">
                      &ldquo;{note.highlightText}&rdquo;
                    </p>
                  )}
                  {note.content && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">
                      {note.content}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    {note.updatedAt.toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditNote(note);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(note.id!);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <FileText className="h-16 w-16 text-muted-foreground/50" />
          <div>
            <h3 className="text-lg font-medium">ยังไม่มีบันทึก</h3>
            <p className="text-sm text-muted-foreground">
              กดปุ่ม &ldquo;เพิ่มโน้ต&rdquo; เพื่อเริ่มจดบันทึก
            </p>
          </div>
          <Button onClick={openNewNote} className="gap-2">
            <Plus className="h-4 w-4" />
            เพิ่มโน้ต
          </Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? "แก้ไขโน้ต" : "เพิ่มโน้ตใหม่"}
            </DialogTitle>
            <DialogDescription>
              จดบันทึกสิ่งที่อยากจำจาก {book.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="หัวข้อ"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Textarea
                placeholder="เนื้อหา..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ลบโน้ตนี้?</DialogTitle>
            <DialogDescription>
              เมื่อลบแล้วจะไม่สามารถกู้คืนได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
