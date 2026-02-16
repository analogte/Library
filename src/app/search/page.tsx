"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search as SearchIcon, BookOpen, Languages } from "lucide-react";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { BookCard } from "@/components/book-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PART_OF_SPEECH_LABELS } from "@/lib/types";
import type { PartOfSpeech } from "@/lib/types";
import Link from "next/link";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const books = useLiveQuery(async () => {
    if (!debouncedQuery.trim()) return [];
    const q = debouncedQuery.toLowerCase();
    const all = await db.books.toArray();
    return all.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [debouncedQuery]);

  const vocab = useLiveQuery(async () => {
    if (!debouncedQuery.trim()) return [];
    const q = debouncedQuery.toLowerCase();
    const all = await db.vocabulary.toArray();
    return all
      .filter(
        (v) =>
          v.word.toLowerCase().includes(q) ||
          v.meaning.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [debouncedQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ค้นหา</h1>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ค้นหาหนังสือหรือคำศัพท์..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 text-lg"
          autoFocus
        />
      </div>

      {query.trim() && (
        <>
          {/* Books */}
          {books && books.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <BookOpen className="h-4 w-4" />
                หนังสือ ({books.length})
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {books.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            </section>
          )}

          {/* Vocabulary */}
          {vocab && vocab.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <Languages className="h-4 w-4" />
                คำศัพท์ ({vocab.length})
              </h2>
              <div className="space-y-2">
                {vocab.map((v) => (
                  <Card key={v.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{v.word}</span>
                      {v.partOfSpeech && (
                        <Badge variant="outline" className="text-[10px]">
                          {PART_OF_SPEECH_LABELS[v.partOfSpeech as PartOfSpeech] ??
                            v.partOfSpeech}
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        — {v.meaning}
                      </span>
                      {v.bookId && (
                        <Link
                          href={`/reader/${v.bookId}`}
                          className="ml-auto text-xs text-primary hover:underline"
                        >
                          เปิดหนังสือ
                        </Link>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {books?.length === 0 && vocab?.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
              <SearchIcon className="h-12 w-12 opacity-50" />
              <p>ไม่พบผลลัพธ์สำหรับ &ldquo;{query}&rdquo;</p>
            </div>
          )}
        </>
      )}

      {!query.trim() && (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <SearchIcon className="h-12 w-12 opacity-50" />
          <p>พิมพ์เพื่อค้นหาหนังสือหรือคำศัพท์</p>
        </div>
      )}
    </div>
  );
}
