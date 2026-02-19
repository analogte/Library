"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuizSummary } from "./quiz-summary";
import type { VocabularyEntry } from "@/lib/types";

interface QuickQuizProps {
  vocabulary: VocabularyEntry[];
  onClose: () => void;
}

const QUESTIONS_PER_ROUND = 10;

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function QuickQuiz({ vocabulary, onClose }: QuickQuizProps) {
  const [mode, setMode] = useState<"en-th" | "th-en">("en-th");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongWords, setWrongWords] = useState<VocabularyEntry[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Pick quiz cards
  const [quizCards] = useState<VocabularyEntry[]>(() => {
    const shuffled = shuffle(vocabulary);
    return shuffled.slice(0, QUESTIONS_PER_ROUND);
  });

  const totalQuestions = quizCards.length;
  const currentCard = quizCards[currentIndex];
  const progressPercent = totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0;

  // Generate 4 options for current question
  const options = useMemo(() => {
    if (!currentCard) return [];
    // Correct answer
    const correct = mode === "en-th" ? currentCard.meaning : currentCard.word;
    // Get 3 random wrong answers from entire vocabulary
    const others = vocabulary
      .filter((v) => v.id !== currentCard.id)
      .map((v) => (mode === "en-th" ? v.meaning : v.word));
    const wrongOptions = shuffle(others).slice(0, 3);
    // Combine and shuffle
    const allOptions = [correct, ...wrongOptions].map((text, i) => ({
      text,
      isCorrect: i === 0,
    }));
    return shuffle(allOptions);
  }, [currentCard, vocabulary, mode]);

  const handleSelect = useCallback(
    (index: number) => {
      if (selectedAnswer !== null) return; // Already answered
      setSelectedAnswer(index);

      const isCorrect = options[index].isCorrect;
      if (isCorrect) {
        setCorrectCount((c) => c + 1);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1500);
      } else {
        setWrongWords((prev) => [...prev, currentCard]);
      }

      // Auto advance after delay
      setTimeout(() => {
        setSelectedAnswer(null);
        if (currentIndex + 1 >= totalQuestions) {
          setShowSummary(true);
        } else {
          setCurrentIndex((i) => i + 1);
        }
      }, 1200);
    },
    [selectedAnswer, options, currentCard, currentIndex, totalQuestions]
  );

  if (totalQuestions < 4) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-muted-foreground">ต้องมีคำศัพท์อย่างน้อย 4 คำถึงจะเล่น Quiz ได้</p>
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          กลับ
        </Button>
      </div>
    );
  }

  if (showSummary) {
    return (
      <QuizSummary
        total={totalQuestions}
        correct={correctCount}
        wrongWords={wrongWords}
        onRestart={() => {
          const newCards = shuffle(vocabulary).slice(0, QUESTIONS_PER_ROUND);
          quizCards.length = 0;
          quizCards.push(...newCards);
          setCurrentIndex(0);
          setCorrectCount(0);
          setWrongWords([]);
          setSelectedAnswer(null);
          setShowSummary(false);
        }}
        onClose={onClose}
      />
    );
  }

  const question = mode === "en-th" ? currentCard.word : currentCard.meaning;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4 relative">
      {/* Confetti overlay */}
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6"][i % 5],
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          กลับ
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode((m) => (m === "en-th" ? "th-en" : "en-th"))}
          className="text-xs"
        >
          <ArrowRightLeft className="mr-1 h-3 w-3" />
          {mode === "en-th" ? "EN→TH" : "TH→EN"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {totalQuestions}
        </span>
      </div>

      <Progress value={progressPercent} className="h-2" />

      {/* Question */}
      <Card className="p-8 text-center">
        <p className="text-xs text-muted-foreground mb-2">
          {mode === "en-th" ? "ความหมายของคำนี้คืออะไร?" : "คำศัพท์ภาษาอังกฤษคือ?"}
        </p>
        <h2 className="text-3xl font-bold">{question}</h2>
      </Card>

      {/* Options */}
      <div className="grid grid-cols-1 gap-3">
        {options.map((opt, i) => {
          let variant: "outline" | "default" = "outline";
          let className = "justify-start text-left h-auto py-3 px-4 text-sm";

          if (selectedAnswer !== null) {
            if (opt.isCorrect) {
              className += " border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";
            } else if (i === selectedAnswer && !opt.isCorrect) {
              className += " border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
            }
          }

          return (
            <Button
              key={i}
              variant={variant}
              className={className}
              onClick={() => handleSelect(i)}
              disabled={selectedAnswer !== null}
            >
              {opt.text}
            </Button>
          );
        })}
      </div>

      {/* Show context when wrong */}
      {selectedAnswer !== null && !options[selectedAnswer].isCorrect && currentCard.exampleSentence && (
        <Card className="p-3 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <p className="text-xs text-muted-foreground">ตัวอย่างประโยค:</p>
          <p className="text-sm italic">&ldquo;{currentCard.exampleSentence}&rdquo;</p>
        </Card>
      )}
    </div>
  );
}
