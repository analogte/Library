"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  RotateCcw,
  BookOpen,
  Trophy,
  X,
  Check,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PART_OF_SPEECH_LABELS } from "@/lib/types";
import type { VocabularyEntry, PartOfSpeech } from "@/lib/types";
import { toast } from "sonner";

interface FlashcardQuizProps {
  vocabulary: VocabularyEntry[];
  bookMap: Map<number, string>;
  onClose: () => void;
}

export function FlashcardQuiz({
  vocabulary,
  bookMap,
  onClose,
}: FlashcardQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<Map<number, boolean>>(new Map());
  const [showSummary, setShowSummary] = useState(false);

  // Shuffle cards on mount
  const [cards] = useState<VocabularyEntry[]>(() => {
    const shuffled = [...vocabulary];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const progressPercent =
    totalCards > 0 ? (results.size / totalCards) * 100 : 0;

  const masteredCount = useMemo(() => {
    let count = 0;
    results.forEach((v) => {
      if (v) count++;
    });
    return count;
  }, [results]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleAnswer = useCallback(
    async (mastered: boolean) => {
      if (!currentCard?.id) return;

      // Update IndexedDB
      await db.vocabulary.update(currentCard.id, {
        mastered,
        updatedAt: new Date(),
      });

      // Track result
      setResults((prev) => {
        const next = new Map(prev);
        next.set(currentCard.id!, mastered);
        return next;
      });

      // Move to next card or show summary
      setIsFlipped(false);

      // Small delay so the card unflips before transitioning
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

  const handleRestart = useCallback(() => {
    // Restart with only unmastered words
    const unmasteredCards = cards.filter((c) => !results.get(c.id!));
    if (unmasteredCards.length === 0) {
      toast.success("จำได้ทุกคำแล้ว!");
      onClose();
      return;
    }
    // Re-shuffle unmastered
    for (let i = unmasteredCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unmasteredCards[i], unmasteredCards[j]] = [
        unmasteredCards[j],
        unmasteredCards[i],
      ];
    }
    // Reset state with unmastered cards
    cards.length = 0;
    cards.push(...unmasteredCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults(new Map());
    setShowSummary(false);
  }, [cards, results, onClose]);

  if (totalCards === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <BookOpen className="h-16 w-16 text-muted-foreground/50" />
        <div>
          <h3 className="text-lg font-medium">ไม่มีคำศัพท์ให้ทบทวน</h3>
          <p className="text-sm text-muted-foreground">
            เพิ่มคำศัพท์จากการอ่านหนังสือก่อนนะ
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          กลับ
        </Button>
      </div>
    );
  }

  // Summary screen
  if (showSummary) {
    const percent =
      totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;
    const unmasteredCount = totalCards - masteredCount;

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
                {masteredCount}
                <span className="text-lg text-muted-foreground">
                  {" "}
                  / {totalCards}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                จำได้ {percent}%
              </p>
            </div>

            <Progress value={percent} className="h-3" />

            <div className="flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span>จำได้ {masteredCount} คำ</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span>ยังจำไม่ได้ {unmasteredCount} คำ</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับ
          </Button>
          {unmasteredCount > 0 && (
            <Button className="flex-1" onClick={handleRestart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              ทบทวนใหม่ ({unmasteredCount} คำ)
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Quiz card
  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          กลับ
        </Button>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {totalCards}
        </span>
      </div>

      {/* Progress */}
      <Progress value={progressPercent} className="h-2" />

      {/* Flashcard */}
      <div
        className="flashcard-container mx-auto cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={handleFlip}
      >
        <div
          className={`flashcard-inner relative w-full transition-transform duration-500`}
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
                  {PART_OF_SPEECH_LABELS[
                    currentCard.partOfSpeech as PartOfSpeech
                  ] ?? currentCard.partOfSpeech}
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
              <p className="text-sm text-muted-foreground">
                {currentCard.word}
              </p>
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
                    {currentCard.bookTitle ||
                      bookMap.get(currentCard.bookId) ||
                      "หนังสือ"}
                    {currentCard.page ? ` หน้า ${currentCard.page}` : ""}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Answer buttons — only visible when flipped */}
      <div
        className={`flex gap-3 transition-opacity duration-300 ${
          isFlipped ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Button
          variant="outline"
          className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
          onClick={(e) => {
            e.stopPropagation();
            handleAnswer(false);
          }}
        >
          <X className="mr-2 h-4 w-4" />
          ยังจำไม่ได้
        </Button>
        <Button
          className="flex-1 bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
          onClick={(e) => {
            e.stopPropagation();
            handleAnswer(true);
          }}
        >
          <Check className="mr-2 h-4 w-4" />
          จำได้แล้ว
        </Button>
      </div>
    </div>
  );
}
