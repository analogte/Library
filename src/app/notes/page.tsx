"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { FileText, BookOpen, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";

export default function NotesOverviewPage() {
  const router = useRouter();

  const books = useLiveQuery(() => db.books.toArray(), []);
  const notes = useLiveQuery(() => db.bookNotes.toArray(), []);

  const booksWithNotes = useMemo(() => {
    if (!books || !notes) return undefined;

    const notesByBook = new Map<number, { count: number; latest: Date }>();
    for (const note of notes) {
      const existing = notesByBook.get(note.bookId);
      if (!existing) {
        notesByBook.set(note.bookId, { count: 1, latest: note.updatedAt });
      } else {
        existing.count++;
        if (note.updatedAt > existing.latest) {
          existing.latest = note.updatedAt;
        }
      }
    }

    return books
      .filter((b) => notesByBook.has(b.id!))
      .map((b) => ({
        book: b,
        noteCount: notesByBook.get(b.id!)!.count,
        latestNote: notesByBook.get(b.id!)!.latest,
      }))
      .sort((a, b) => b.latestNote.getTime() - a.latestNote.getTime());
  }, [books, notes]);

  if (booksWithNotes === undefined) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileText className="h-6 w-6" />
          บันทึกทั้งหมด
        </h1>
        <p className="text-sm text-muted-foreground">
          {notes?.length ?? 0} รายการ จาก {booksWithNotes.length} เล่ม
        </p>
      </div>

      {booksWithNotes.length > 0 ? (
        <div className="space-y-3">
          {booksWithNotes.map(({ book, noteCount, latestNote }) => (
            <Card
              key={book.id}
              className="cursor-pointer p-4 transition-colors hover:bg-accent"
              onClick={() => router.push(`/notes/${book.id}`)}
            >
              <div className="flex items-center gap-3">
                {book.coverImage ? (
                  <img
                    src={book.coverImage}
                    alt={book.title}
                    className="h-12 w-8 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-8 flex-shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium leading-tight truncate">
                    {book.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {noteCount} บันทึก &middot;{" "}
                    {latestNote.toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
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
              เปิดหนังสือแล้วกดปุ่ม บันทึก เพื่อเริ่มจดโน้ต
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
