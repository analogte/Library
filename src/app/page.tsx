"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Library } from "lucide-react";
import { db } from "@/lib/db";
import { deleteBook } from "@/lib/book-utils";
import { BookCard } from "@/components/book-card";
import { UploadDialog } from "@/components/upload-dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Book } from "@/lib/types";

type FilterStatus = "all" | "unread" | "reading" | "finished";

export default function LibraryPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const books = useLiveQuery(() => db.books.orderBy("updatedAt").reverse().toArray(), [refreshKey]);

  const readingProgress = useLiveQuery(async () => {
    const progress = await db.readingProgress.toArray();
    const map = new Map<number, number>();
    for (const p of progress) {
      map.set(p.bookId, p.percentage);
    }
    return map;
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const filteredBooks = books?.filter((b) =>
    filter === "all" ? true : b.status === filter
  );

  const readingBooks = books?.filter((b) => b.status === "reading") ?? [];

  const handleDelete = async (id: number) => {
    await deleteBook(id);
    toast.success("ลบหนังสือแล้ว");
  };

  const handleStatusChange = async (id: number, status: Book["status"]) => {
    await db.books.update(id, { status, updatedAt: new Date() });
    toast.success(
      status === "reading"
        ? "เปลี่ยนเป็น กำลังอ่าน"
        : status === "finished"
        ? "เปลี่ยนเป็น อ่านจบแล้ว"
        : "เปลี่ยนสถานะแล้ว"
    );
  };

  if (!books) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-muted-foreground">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ห้องสมุดส่วนตัว</h1>
          <p className="text-sm text-muted-foreground">
            {books.length} เล่ม
          </p>
        </div>
        <UploadDialog onUploadComplete={refresh} />
      </div>

      {/* Currently Reading Section */}
      {readingBooks.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5" />
            กำลังอ่าน
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {readingBooks.map((book) => {
              const progress = readingProgress?.get(book.id!) ?? 0;
              return (
                <div
                  key={book.id}
                  onClick={() => router.push(`/reader/${book.id}`)}
                  className="flex w-64 flex-shrink-0 cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
                >
                  {book.coverImage ? (
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="h-16 w-11 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-11 items-center justify-center rounded bg-muted text-muted-foreground">
                      <BookOpen className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{book.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {book.author || "ไม่ทราบผู้แต่ง"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Progress value={progress} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "unread", "reading", "finished"] as FilterStatus[]).map((s) => (
          <Badge
            key={s}
            variant={filter === s ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "ทั้งหมด" : s === "unread" ? "ยังไม่อ่าน" : s === "reading" ? "กำลังอ่าน" : "อ่านจบแล้ว"}
          </Badge>
        ))}
      </div>

      {/* Book grid */}
      {filteredBooks && filteredBooks.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              progress={readingProgress?.get(book.id!) ?? 0}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Library className="h-16 w-16 text-muted-foreground/50" />
          <div>
            <h3 className="text-lg font-medium">ห้องสมุดว่างเปล่า</h3>
            <p className="text-sm text-muted-foreground">
              เพิ่มหนังสือ PDF หรือ EPUB เพื่อเริ่มอ่าน
            </p>
          </div>
          <UploadDialog onUploadComplete={refresh} />
        </div>
      )}
    </div>
  );
}
