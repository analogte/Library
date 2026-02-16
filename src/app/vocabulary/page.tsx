"use client";

import { useState, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Languages,
  Search,
  BookOpen,
  Check,
  Trash2,
  ExternalLink,
  GraduationCap,
} from "lucide-react";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { PART_OF_SPEECH_LABELS } from "@/lib/types";
import type { PartOfSpeech } from "@/lib/types";
import { toast } from "sonner";
import Link from "next/link";
import { FlashcardQuiz } from "@/components/vocabulary/flashcard-quiz";

export default function VocabularyPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterPOS, setFilterPOS] = useState<string>("all");
  const [filterBook, setFilterBook] = useState<string>("all");
  const [filterMastered, setFilterMastered] = useState<string>("all");
  const [showQuiz, setShowQuiz] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const vocabulary = useLiveQuery(
    async () => {
      let collection = db.vocabulary.orderBy("createdAt").reverse();

      // Apply indexed filters at Dexie level
      if (filterMastered === "mastered") {
        collection = db.vocabulary.where("mastered").equals(1).reverse();
      } else if (filterMastered === "learning") {
        collection = db.vocabulary.where("mastered").equals(0).reverse();
      }

      let results = await collection.toArray();

      // Apply non-indexed filters in JS
      if (filterPOS !== "all") {
        results = results.filter((v) => v.partOfSpeech === filterPOS);
      }
      if (filterBook !== "all") {
        results = results.filter((v) => String(v.bookId) === filterBook);
      }

      return results;
    },
    [filterPOS, filterBook, filterMastered]
  );

  const books = useLiveQuery(() => db.books.toArray(), []);

  const bookMap = useMemo(
    () => new Map(books?.map((b) => [b.id, b.title]) ?? []),
    [books]
  );

  const filtered = useMemo(() => {
    if (!vocabulary) return undefined;
    if (!debouncedSearch) return vocabulary;
    const q = debouncedSearch.toLowerCase();
    return vocabulary.filter(
      (v) =>
        v.word.toLowerCase().includes(q) ||
        v.meaning.toLowerCase().includes(q)
    );
  }, [vocabulary, debouncedSearch]);

  const toggleMastered = async (id: number, current: boolean) => {
    await db.vocabulary.update(id, {
      mastered: !current,
      updatedAt: new Date(),
    });
    toast.success(!current ? "จำได้แล้ว!" : "กลับมาเรียนใหม่");
  };

  const deleteWord = async (id: number) => {
    await db.vocabulary.delete(id);
    toast.success("ลบคำศัพท์แล้ว");
  };

  // Show quiz mode
  if (showQuiz && filtered) {
    return (
      <FlashcardQuiz
        vocabulary={filtered}
        bookMap={bookMap as Map<number, string>}
        onClose={() => setShowQuiz(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Languages className="h-6 w-6" />
            คลังคำศัพท์
          </h1>
          <p className="text-sm text-muted-foreground">
            {vocabulary?.length ?? 0} คำ
            {filtered && filtered.length !== vocabulary?.length
              ? ` (แสดง ${filtered.length})`
              : ""}
          </p>
        </div>
        {filtered && filtered.length > 0 && (
          <Button
            onClick={() => setShowQuiz(true)}
            className="gap-2"
          >
            <GraduationCap className="h-4 w-4" />
            ทบทวนคำศัพท์
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ค้นหาคำศัพท์..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterPOS} onValueChange={setFilterPOS}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="ชนิดคำ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกชนิดคำ</SelectItem>
            {Object.entries(PART_OF_SPEECH_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBook} onValueChange={setFilterBook}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="หนังสือ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกเล่ม</SelectItem>
            {books?.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMastered} onValueChange={setFilterMastered}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="learning">กำลังเรียน</SelectItem>
            <SelectItem value="mastered">จำได้แล้ว</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vocabulary list */}
      {filtered && filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((v) => (
            <Card key={v.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-semibold">{v.word}</span>
                    {v.partOfSpeech && (
                      <Badge variant="outline" className="text-[10px]">
                        {PART_OF_SPEECH_LABELS[v.partOfSpeech as PartOfSpeech] ??
                          v.partOfSpeech}
                      </Badge>
                    )}
                    {v.mastered && (
                      <Badge className="bg-green-600 text-[10px]">
                        จำได้แล้ว
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {v.meaning}
                  </p>
                  {v.exampleSentence && (
                    <p className="mt-1 text-xs italic text-muted-foreground/70">
                      &ldquo;{v.exampleSentence}&rdquo;
                    </p>
                  )}
                  {v.bookId && (
                    <Link
                      href={`/reader/${v.bookId}${v.page ? `?page=${v.page}` : ""}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <BookOpen className="h-3 w-3" />
                      {v.bookTitle || bookMap.get(v.bookId) || "หนังสือ"}
                      {v.page ? ` หน้า ${v.page}` : ""}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleMastered(v.id!, v.mastered)}
                    title={v.mastered ? "กลับมาเรียนใหม่" : "จำได้แล้ว"}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteWord(v.id!)}
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
          <Languages className="h-16 w-16 text-muted-foreground/50" />
          <div>
            <h3 className="text-lg font-medium">ยังไม่มีคำศัพท์</h3>
            <p className="text-sm text-muted-foreground">
              เลือกข้อความขณะอ่านหนังสือเพื่อบันทึกคำศัพท์
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
