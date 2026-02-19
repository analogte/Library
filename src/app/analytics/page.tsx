"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, TrendingDown, Lightbulb, BookOpen, Clock } from "lucide-react";
import { db } from "@/lib/db";
import {
  getReadingHeatmapData,
  getWeeklyReadingData,
  getVocabGrowthData,
  getStreakData,
  getReadingInsights,
  getMonthlyComparison,
} from "@/lib/analytics-utils";
import { StatsCards } from "@/components/analytics/stats-cards";
import { ReadingHeatmap } from "@/components/analytics/reading-heatmap";
import { WeeklyChart } from "@/components/analytics/weekly-chart";
import { VocabGrowthChart } from "@/components/analytics/vocab-growth-chart";
import { Card } from "@/components/ui/card";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [finishedBooks, setFinishedBooks] = useState(0);
  const [vocabCount, setVocabCount] = useState(0);
  const [streakData, setStreakData] = useState({ current: 0, longest: 0 });
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [weeklyData, setWeeklyData] = useState<{ week: string; minutes: number }[]>([]);
  const [vocabGrowthData, setVocabGrowthData] = useState<{ week: string; total: number }[]>([]);
  const [insights, setInsights] = useState<{ peakHour: string; avgSessionMinutes: number; favoriteBook: string | null }>({ peakHour: "-", avgSessionMinutes: 0, favoriteBook: null });
  const [monthly, setMonthly] = useState({ thisMonth: 0, lastMonth: 0, changePercent: 0 });

  useEffect(() => {
    (async () => {
      const [
        sessions,
        finished,
        vocab,
        streak,
        heatmap,
        weekly,
        vocabGrowth,
        insightsData,
        monthlyData,
      ] = await Promise.all([
        db.readingSessions.toArray(),
        db.books.where("status").equals("finished").count(),
        db.vocabulary.count(),
        getStreakData(),
        getReadingHeatmapData(),
        getWeeklyReadingData(),
        getVocabGrowthData(),
        getReadingInsights(),
        getMonthlyComparison(),
      ]);

      setTotalMinutes(sessions.reduce((sum, s) => sum + s.durationMinutes, 0));
      setFinishedBooks(finished);
      setVocabCount(vocab);
      setStreakData(streak);
      setHeatmapData(heatmap);
      setWeeklyData(weekly);
      setVocabGrowthData(vocabGrowth);
      setInsights(insightsData);
      setMonthly(monthlyData);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <BarChart3 className="h-6 w-6" />
        สถิติการอ่าน
      </h1>

      <StatsCards
        totalMinutes={totalMinutes}
        finishedBooks={finishedBooks}
        vocabCount={vocabCount}
        currentStreak={streakData.current}
        longestStreak={streakData.longest}
      />

      <Card className="p-4 overflow-hidden">
        <ReadingHeatmap data={heatmapData} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <WeeklyChart data={weeklyData} />
        </Card>
        <Card className="p-4">
          <VocabGrowthChart data={vocabGrowthData} />
        </Card>
      </div>

      {/* Monthly comparison */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${monthly.changePercent >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
            {monthly.changePercent >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">
              เดือนนี้ vs เดือนก่อน:{" "}
              <span className={monthly.changePercent >= 0 ? "text-green-600" : "text-red-600"}>
                {monthly.changePercent >= 0 ? "+" : ""}{monthly.changePercent}%
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              เดือนนี้ {Math.round(monthly.thisMonth)} นาที &middot; เดือนก่อน {Math.round(monthly.lastMonth)} นาที
            </p>
          </div>
        </div>
      </Card>

      {/* Insights */}
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          Insights
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>คุณอ่านเร็วสุดช่วง <strong>{insights.peakHour}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span>เวลาอ่านเฉลี่ย <strong>{insights.avgSessionMinutes} นาที</strong> ต่อครั้ง</span>
          </div>
          {insights.favoriteBook && (
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span>หนังสือที่อ่านบ่อยสุด: <strong>{insights.favoriteBook}</strong></span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
