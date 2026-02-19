"use client";

import { Clock, BookCheck, Languages, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardsProps {
  totalMinutes: number;
  finishedBooks: number;
  vocabCount: number;
  currentStreak: number;
  longestStreak: number;
}

export function StatsCards({
  totalMinutes,
  finishedBooks,
  vocabCount,
  currentStreak,
  longestStreak,
}: StatsCardsProps) {
  const items = [
    {
      icon: Clock,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      label: "เวลาอ่านรวม",
      value:
        totalMinutes >= 60
          ? `${Math.floor(totalMinutes / 60)} ชม. ${Math.round(totalMinutes % 60)} นาที`
          : `${Math.round(totalMinutes)} นาที`,
    },
    {
      icon: BookCheck,
      color: "text-green-500",
      bg: "bg-green-500/10",
      label: "อ่านจบแล้ว",
      value: `${finishedBooks} เล่ม`,
    },
    {
      icon: Languages,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      label: "คำศัพท์",
      value: `${vocabCount} คำ`,
    },
    {
      icon: Flame,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      label: "สตรีค",
      value: `${currentStreak} วัน`,
      sub: longestStreak > currentStreak ? `สูงสุด ${longestStreak} วัน` : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="py-3 gap-0">
          <CardContent className="flex items-center gap-3 px-4">
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold">{item.value}</p>
              {item.sub && (
                <p className="text-[10px] text-muted-foreground">{item.sub}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
