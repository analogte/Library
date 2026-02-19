"use client";

import { useEffect } from "react";
import { Trophy, ArrowLeft, RotateCcw, BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { VocabularyEntry } from "@/lib/types";

interface QuizSummaryProps {
  total: number;
  correct: number;
  wrongWords: VocabularyEntry[];
  onRestart: () => void;
  onClose: () => void;
}

export function QuizSummary({
  total,
  correct,
  wrongWords,
  onRestart,
  onClose,
}: QuizSummaryProps) {
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Save quiz session
  useEffect(() => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    db.quizSessions.add({
      date: dateStr,
      totalQuestions: total,
      correctAnswers: correct,
      createdAt: new Date(),
    });
  }, [total, correct]);

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div className="text-center">
        <Trophy className="mx-auto h-16 w-16 text-yellow-500" />
        <h2 className="mt-4 text-2xl font-bold">
          {percent >= 80 ? "เก่งมาก!" : percent >= 50 ? "ดีเลย!" : "ฝึกต่อนะ!"}
        </h2>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600">
              {correct}
              <span className="text-lg text-muted-foreground"> / {total}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">ถูก {percent}%</p>
          </div>
          <Progress value={percent} className="h-3" />
        </div>
      </Card>

      {/* Wrong words review */}
      {wrongWords.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 font-semibold text-sm">คำที่ตอบผิด ({wrongWords.length})</h3>
          <div className="space-y-2">
            {wrongWords.map((w) => (
              <div key={w.id} className="flex items-start gap-2 text-sm">
                <span className="font-medium">{w.word}</span>
                <span className="text-muted-foreground">— {w.meaning}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          กลับ
        </Button>
        <Button className="flex-1" onClick={onRestart}>
          <RotateCcw className="mr-2 h-4 w-4" />
          เล่นอีกรอบ
        </Button>
      </div>
    </div>
  );
}
