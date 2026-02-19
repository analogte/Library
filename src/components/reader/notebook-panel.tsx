"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  X,
  Maximize2,
  Minimize2,
  Plus,
  Pencil,
  Trash2,
  FileText,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { toast } from "sonner";
import type { BookNote } from "@/lib/types";

interface NotebookPanelProps {
  bookId: number;
  bookTitle: string;
  currentPage: number;
  isEpub?: boolean;
  expanded: boolean;
  highlightText?: string;
  onExpandedChange: (expanded: boolean) => void;
  onClose: () => void;
  onClearHighlight?: () => void;
}

export function NotebookPanel({
  bookId,
  bookTitle,
  currentPage,
  isEpub,
  expanded,
  highlightText,
  onExpandedChange,
  onClose,
  onClearHighlight,
}: NotebookPanelProps) {
  // Notes data (reactive)
  const notes = useLiveQuery(
    () => db.bookNotes.where("bookId").equals(bookId).reverse().sortBy("updatedAt"),
    [bookId]
  );

  // Quick add form (sidebar mode)
  const [quickTitle, setQuickTitle] = useState("");
  const [quickContent, setQuickContent] = useState("");

  // Expanded mode: selected note for editing
  const [selectedNote, setSelectedNote] = useState<BookNote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editHighlight, setEditHighlight] = useState("");
  const [editPage, setEditPage] = useState<number | undefined>();
  const [isNewNote, setIsNewNote] = useState(false);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const quickTitleRef = useRef<HTMLInputElement>(null);

  // When highlightText arrives, populate the form
  useEffect(() => {
    if (highlightText) {
      if (expanded && selectedNote) {
        // In expanded mode with a note selected, append to edit
        setEditHighlight(highlightText);
      } else if (expanded) {
        // In expanded mode, create new note with highlight
        handleNewNoteExpanded();
        setEditHighlight(highlightText);
      } else {
        // In sidebar mode, set quick add highlight
        setQuickContent((prev) => prev);
      }
      onClearHighlight?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightText]);

  // Group notes by page (current page first)
  const groupedNotes = useMemo(() => {
    if (!notes) return [];

    const groups = new Map<number | undefined, BookNote[]>();
    for (const note of notes) {
      const key = note.page;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(note);
    }

    // Sort: current page first, then other pages desc, then undefined
    const entries = Array.from(groups.entries());
    entries.sort(([a], [b]) => {
      if (a === currentPage) return -1;
      if (b === currentPage) return 1;
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      return b - a;
    });

    return entries;
  }, [notes, currentPage]);

  const pageLabel = isEpub ? `${currentPage}%` : `หน้า ${currentPage}`;

  // --- Quick Add (sidebar mode) ---
  const handleQuickSave = async () => {
    if (!quickTitle.trim() && !quickContent.trim() && !highlightText) {
      toast.error("กรุณาใส่หัวข้อหรือเนื้อหา");
      return;
    }
    const now = new Date();
    await db.bookNotes.add({
      bookId,
      title: quickTitle.trim(),
      content: quickContent.trim(),
      page: currentPage,
      pageLabel,
      highlightText: highlightText || undefined,
      createdAt: now,
      updatedAt: now,
    });
    setQuickTitle("");
    setQuickContent("");
    onClearHighlight?.();
    toast.success("บันทึกแล้ว");
    quickTitleRef.current?.focus();
  };

  // --- Expanded mode functions ---
  const handleNewNoteExpanded = () => {
    setSelectedNote(null);
    setIsNewNote(true);
    setEditTitle("");
    setEditContent("");
    setEditHighlight("");
    setEditPage(currentPage);
  };

  const handleSelectNote = (note: BookNote) => {
    setSelectedNote(note);
    setIsNewNote(false);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditHighlight(note.highlightText || "");
    setEditPage(note.page);
  };

  const handleExpandedSave = async () => {
    if (!editTitle.trim() && !editContent.trim()) {
      toast.error("กรุณาใส่หัวข้อหรือเนื้อหา");
      return;
    }
    const now = new Date();
    const pl = editPage !== undefined
      ? isEpub ? `${editPage}%` : `หน้า ${editPage}`
      : undefined;

    if (isNewNote || !selectedNote?.id) {
      const id = await db.bookNotes.add({
        bookId,
        title: editTitle.trim(),
        content: editContent.trim(),
        page: editPage,
        pageLabel: pl,
        highlightText: editHighlight || undefined,
        createdAt: now,
        updatedAt: now,
      });
      // Select the new note
      const newNote = await db.bookNotes.get(id);
      if (newNote) {
        setSelectedNote(newNote);
        setIsNewNote(false);
      }
      toast.success("เพิ่มโน้ตแล้ว");
    } else {
      await db.bookNotes.update(selectedNote.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        page: editPage,
        pageLabel: pl,
        highlightText: editHighlight || undefined,
        updatedAt: now,
      });
      toast.success("อัปเดตแล้ว");
    }
    onClearHighlight?.();
  };

  const handleDelete = async (id: number) => {
    await db.bookNotes.delete(id);
    setDeleteConfirmId(null);
    if (selectedNote?.id === id) {
      setSelectedNote(null);
      setIsNewNote(false);
    }
    toast.success("ลบโน้ตแล้ว");
  };

  // --- Render note card ---
  const renderNoteCard = (note: BookNote, compact = false) => (
    <div
      key={note.id}
      className={`group rounded-lg border p-2.5 cursor-pointer transition-colors hover:bg-accent ${
        expanded && selectedNote?.id === note.id ? "border-primary bg-accent" : ""
      }`}
      onClick={() => expanded ? handleSelectNote(note) : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight truncate">
            {note.title || "ไม่มีหัวข้อ"}
          </p>
          {!compact && note.content && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
              {note.content}
            </p>
          )}
          {note.highlightText && (
            <p className="mt-1 text-xs text-muted-foreground/80 italic line-clamp-1 border-l-2 border-primary/30 pl-1.5">
              &ldquo;{note.highlightText}&rdquo;
            </p>
          )}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!expanded && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                // Switch to expanded to edit
                onExpandedChange(true);
                setTimeout(() => handleSelectNote(note), 50);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmId(note.id!);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground/60">
        {note.updatedAt.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );

  // --- SIDEBAR MODE ---
  if (!expanded) {
    return (
      <div className="flex h-full w-80 flex-col border-l bg-card md:w-96 max-md:absolute max-md:inset-0 max-md:z-40 max-md:w-full max-md:border-l-0">
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b px-3 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">สมุดบันทึก</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onExpandedChange(true)} title="ขยาย">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Quick Add */}
        <div className="border-b p-3 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {pageLabel}
            </span>
            <Input
              ref={quickTitleRef}
              placeholder="หัวข้อ..."
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              className="h-7 text-sm"
            />
          </div>
          <Textarea
            placeholder="เนื้อหา..."
            value={quickContent}
            onChange={(e) => setQuickContent(e.target.value)}
            rows={2}
            className="resize-none text-sm"
          />
          {highlightText && (
            <div className="flex items-start gap-1.5 rounded border-l-2 border-primary/40 bg-muted/50 px-2 py-1.5">
              <span className="text-xs text-muted-foreground italic line-clamp-2">
                &ldquo;{highlightText}&rdquo;
              </span>
              <button
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={onClearHighlight}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" className="h-7 text-xs" onClick={handleQuickSave}>
              บันทึก
            </Button>
          </div>
        </div>

        {/* Notes list grouped by page */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {groupedNotes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">ยังไม่มีบันทึก</p>
            </div>
          )}
          {groupedNotes.map(([page, pageNotes]) => (
            <div key={page ?? "no-page"}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {page === currentPage
                    ? `${isEpub ? `${page}%` : `หน้า ${page}`} (ปัจจุบัน)`
                    : page !== undefined
                      ? isEpub ? `${page}%` : `หน้า ${page}`
                      : "ไม่ระบุหน้า"}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-1.5">
                {pageNotes.map((note) => renderNoteCard(note))}
              </div>
            </div>
          ))}
        </div>

        {/* Delete confirm */}
        {deleteConfirmId !== null && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80">
            <Card className="mx-4 w-full max-w-xs p-4 space-y-3">
              <p className="text-sm font-medium">ลบโน้ตนี้?</p>
              <p className="text-xs text-muted-foreground">เมื่อลบแล้วจะไม่สามารถกู้คืนได้</p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)}>ยกเลิก</Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(deleteConfirmId)}>ลบ</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // --- EXPANDED MODE ---
  return (
    <div className="flex h-full w-[48rem] max-w-[70vw] flex-col border-l bg-card max-md:absolute max-md:inset-0 max-md:z-40 max-md:w-full max-md:max-w-full max-md:border-l-0">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium truncate">
            สมุดบันทึก — {bookTitle}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onExpandedChange(false)} title="ย่อ">
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Body: note list + editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Note list sidebar */}
        <div className="w-56 shrink-0 border-r flex flex-col overflow-hidden md:w-60">
          <div className="p-2 border-b shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 h-8 text-xs"
              onClick={handleNewNoteExpanded}
            >
              <Plus className="h-3.5 w-3.5" />
              สร้างใหม่
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {notes?.map((note) => (
              <div
                key={note.id}
                className={`rounded-md border px-2 py-1.5 cursor-pointer transition-colors hover:bg-accent ${
                  selectedNote?.id === note.id ? "border-primary bg-accent" : ""
                }`}
                onClick={() => handleSelectNote(note)}
              >
                <p className="text-xs font-medium truncate">{note.title || "ไม่มีหัวข้อ"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {note.page !== undefined && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                      {isEpub ? `${note.page}%` : `น.${note.page}`}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">
                    {note.updatedAt.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
            ))}
            {(!notes || notes.length === 0) && (
              <p className="py-6 text-center text-xs text-muted-foreground">ยังไม่มีโน้ต</p>
            )}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {(selectedNote || isNewNote) ? (
            <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-3">
              <Input
                placeholder="หัวข้อ"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-base font-medium"
                autoFocus={isNewNote}
              />
              <Textarea
                placeholder="เนื้อหา..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 min-h-[200px] resize-none"
              />
              {(editHighlight || highlightText) && (
                <div className="flex items-start gap-2 rounded border-l-2 border-primary/40 bg-muted/50 px-3 py-2">
                  <p className="flex-1 text-sm text-muted-foreground italic">
                    &ldquo;{editHighlight || highlightText}&rdquo;
                  </p>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditHighlight("");
                      onClearHighlight?.();
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {editPage !== undefined
                      ? isEpub ? `${editPage}%` : `หน้า ${editPage}`
                      : "ไม่ระบุหน้า"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedNote?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive text-xs h-8"
                      onClick={() => setDeleteConfirmId(selectedNote.id!)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      ลบ
                    </Button>
                  )}
                  <Button size="sm" className="h-8 text-xs" onClick={handleExpandedSave}>
                    บันทึก
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <FileText className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                เลือกโน้ตจากรายการ หรือกด &ldquo;สร้างใหม่&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteConfirmId !== null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80">
          <Card className="mx-4 w-full max-w-xs p-4 space-y-3">
            <p className="text-sm font-medium">ลบโน้ตนี้?</p>
            <p className="text-xs text-muted-foreground">เมื่อลบแล้วจะไม่สามารถกู้คืนได้</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)}>ยกเลิก</Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(deleteConfirmId)}>ลบ</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
