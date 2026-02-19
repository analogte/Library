"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Library, Clock, BookCheck, Languages, Flame } from "lucide-react";
import { db } from "@/lib/db";
import { deleteBook } from "@/lib/book-utils";
import { BookCard } from "@/components/book-card";
import { UploadDialog } from "@/components/upload-dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

  // Reading statistics
  const totalReadingMinutes = useLiveQuery(async () => {
    const sessions = await db.readingSessions.toArray();
    return sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [refreshKey]);

  const finishedCount = useLiveQuery(async () => {
    return db.books.where("status").equals("finished").count();
  }, [refreshKey]);

  const vocabCount = useLiveQuery(async () => {
    return db.vocabulary.count();
  }, [refreshKey]);

  const currentStreak = useLiveQuery(async () => {
    const sessions = await db.readingSessions.toArray();
    if (sessions.length === 0) return 0;

    // Get unique reading dates (YYYY-MM-DD)
    const dateSet = new Set<string>();
    for (const s of sessions) {
      const d = new Date(s.startedAt);
      dateSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }

    const sortedDates = Array.from(dateSet).sort().reverse();

    // Check if today or yesterday is the most recent reading day
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    if (sortedDates[0] !== todayStr && sortedDates[0] !== yesterdayStr) {
      return 0;
    }

    // Count consecutive days
    let streak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const current = new Date(sortedDates[i - 1]);
      const prev = new Date(sortedDates[i]);
      const diffDays = (current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (Math.round(diffDays) === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
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

      {/* Reading Statistics — clickable → /analytics */}
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 cursor-pointer"
        onClick={() => router.push("/analytics")}
      >
        <Card className="py-3 gap-0 transition-colors hover:bg-accent">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">เวลาอ่านรวม</p>
              <p className="text-sm font-semibold">
                {totalReadingMinutes != null
                  ? totalReadingMinutes >= 60
                    ? `${Math.floor(totalReadingMinutes / 60)} ชม. ${Math.round(totalReadingMinutes % 60)} นาที`
                    : `${Math.round(totalReadingMinutes)} นาที`
                  : "..."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="py-3 gap-0 transition-colors hover:bg-accent">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-500/10">
              <BookCheck className="h-4 w-4 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">อ่านจบแล้ว</p>
              <p className="text-sm font-semibold">
                {finishedCount != null ? `${finishedCount} เล่ม` : "..."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="py-3 gap-0 transition-colors hover:bg-accent">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
              <Languages className="h-4 w-4 text-purple-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">คำศัพท์</p>
              <p className="text-sm font-semibold">
                {vocabCount != null ? `${vocabCount} คำ` : "..."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="py-3 gap-0 transition-colors hover:bg-accent">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">สตรีค</p>
              <p className="text-sm font-semibold">
                {currentStreak != null ? `${currentStreak} วัน` : "..."}
              </p>
            </div>
          </CardContent>
        </Card>
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
