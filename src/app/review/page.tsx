"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Brain,
  Trophy,
  RotateCcw,
  Check,
  BookOpen,
} from "lucide-react";
import { db } from "@/lib/db";
import { getReviewQueue } from "@/lib/review-utils";
import { calculateSM2 } from "@/lib/sm2";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PART_OF_SPEECH_LABELS } from "@/lib/types";
import type { VocabularyEntry, PartOfSpeech } from "@/lib/types";
import Link from "next/link";

export default function ReviewPage() {
  const [cards, setCards] = useState<VocabularyEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [results, setResults] = useState<Map<number, number>>(new Map()); // id → quality
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReviewQueue().then((queue) => {
      // Shuffle
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      setCards(queue);
      setLoading(false);
    });
  }, []);

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const progressPercent = totalCards > 0 ? (results.size / totalCards) * 100 : 0;

  const stats = useMemo(() => {
    let good = 0;
    let bad = 0;
    results.forEach((q) => {
      if (q >= 3) good++;
      else bad++;
    });
    return { good, bad };
  }, [results]);

  const handleRate = useCallback(
    async (quality: number) => {
      if (!currentCard?.id) return;

      const sm2Result = calculateSM2({
        quality,
        repetitions: currentCard.repetitions ?? 0,
        easeFactor: currentCard.easeFactor ?? 2.5,
        interval: currentCard.interval ?? 0,
      });

      await db.vocabulary.update(currentCard.id, {
        nextReviewAt: sm2Result.nextReviewAt,
        interval: sm2Result.interval,
        easeFactor: sm2Result.easeFactor,
        repetitions: sm2Result.repetitions,
        mastered: quality >= 4 && sm2Result.repetitions >= 3,
        updatedAt: new Date(),
      });

      setResults((prev) => {
        const next = new Map(prev);
        next.set(currentCard.id!, quality);
        return next;
      });

      setIsFlipped(false);
      setTimeout(() => {
        if (currentIndex + 1 >= totalCards) {
          setShowSummary(true);
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      }, 200);
    },
    [currentCard, currentIndex, totalCards]
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  if (totalCards === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Brain className="h-16 w-16 text-muted-foreground/50" />
        <div>
          <h3 className="text-lg font-medium">ไม่มีคำศัพท์ต้องทบทวน</h3>
          <p className="text-sm text-muted-foreground">
            คำศัพท์ที่ถึงเวลาทบทวนจะปรากฏที่นี่
          </p>
        </div>
        <Link href="/vocabulary">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับคลังคำศัพท์
          </Button>
        </Link>
      </div>
    );
  }

  // Summary screen
  if (showSummary) {
    const percent = totalCards > 0 ? Math.round((stats.good / totalCards) * 100) : 0;
    return (
      <div className="mx-auto max-w-md space-y-6 py-8">
        <div className="text-center">
          <Trophy className="mx-auto h-16 w-16 text-yellow-500" />
          <h2 className="mt-4 text-2xl font-bold">ทบทวนเสร็จแล้ว!</h2>
        </div>
        <Card className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600">
                {stats.good}
                <span className="text-lg text-muted-foreground"> / {totalCards}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">จำได้ {percent}%</p>
            </div>
            <Progress value={percent} className="h-3" />
            <div className="flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span>จำได้ {stats.good} คำ</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span>ลืม {stats.bad} คำ</span>
              </div>
            </div>
          </div>
        </Card>
        <div className="flex gap-3">
          <Link href="/vocabulary" className="flex-1">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              กลับ
            </Button>
          </Link>
          {stats.bad > 0 && (
            <Button
              className="flex-1"
              onClick={() => {
                const failed = cards.filter((c) => {
                  const q = results.get(c.id!);
                  return q !== undefined && q < 3;
                });
                for (let i = failed.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [failed[i], failed[j]] = [failed[j], failed[i]];
                }
                setCards(failed);
                setCurrentIndex(0);
                setIsFlipped(false);
                setResults(new Map());
                setShowSummary(false);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              ทบทวนคำที่ลืม ({stats.bad})
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Flashcard review
  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/vocabulary">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับ
          </Button>
        </Link>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {totalCards}
        </span>
      </div>

      <Progress value={progressPercent} className="h-2" />

      {/* Flashcard */}
      <div
        className="flashcard-container mx-auto cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setIsFlipped((prev) => !prev)}
      >
        <div
          className="flashcard-inner relative w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            minHeight: "320px",
          }}
        >
          {/* Front */}
          <Card
            className="flashcard-face absolute inset-0 flex flex-col items-center justify-center p-8"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">{currentCard.word}</h2>
              {currentCard.partOfSpeech && (
                <Badge variant="outline" className="text-sm">
                  {PART_OF_SPEECH_LABELS[currentCard.partOfSpeech as PartOfSpeech] ??
                    currentCard.partOfSpeech}
                </Badge>
              )}
              <p className="text-sm text-muted-foreground pt-4">
                แตะเพื่อดูคำตอบ
              </p>
            </div>
          </Card>

          {/* Back */}
          <Card
            className="flashcard-face absolute inset-0 flex flex-col items-center justify-center p-8"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="text-center space-y-4 w-full">
              <p className="text-sm text-muted-foreground">{currentCard.word}</p>
              <h2 className="text-2xl font-bold">{currentCard.meaning}</h2>
              {currentCard.exampleSentence && (
                <p className="text-sm italic text-muted-foreground/80 border-l-2 border-primary/30 pl-3 text-left">
                  &ldquo;{currentCard.exampleSentence}&rdquo;
                </p>
              )}
              {currentCard.bookId && (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-2">
                  <BookOpen className="h-3 w-3" />
                  <span>
                    {currentCard.bookTitle || "หนังสือ"}
                    {currentCard.page ? ` หน้า ${currentCard.page}` : ""}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* SM-2 Rating buttons — visible when flipped */}
      <div
        className={`grid grid-cols-4 gap-2 transition-opacity duration-300 ${
          isFlipped ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Button
          variant="outline"
          className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          onClick={(e) => {
            e.stopPropagation();
            handleRate(0);
          }}
        >
          ลืม
        </Button>
        <Button
          variant="outline"
          className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950"
          onClick={(e) => {
            e.stopPropagation();
            handleRate(3);
          }}
        >
          ยาก
        </Button>
        <Button
          variant="outline"
          className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
          onClick={(e) => {
            e.stopPropagation();
            handleRate(4);
          }}
        >
          ดี
        </Button>
        <Button
          className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
          onClick={(e) => {
            e.stopPropagation();
            handleRate(5);
          }}
        >
          <Check className="mr-1 h-4 w-4" />
          ง่าย
        </Button>
      </div>
    </div>
  );
}
