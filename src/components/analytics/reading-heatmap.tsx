"use client";

import { useMemo } from "react";

interface ReadingHeatmapProps {
  data: Map<string, number>;
}

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function getIntensity(minutes: number): string {
  if (minutes === 0) return "bg-muted";
  if (minutes < 15) return "bg-green-200 dark:bg-green-900";
  if (minutes < 30) return "bg-green-400 dark:bg-green-700";
  if (minutes < 60) return "bg-green-600 dark:bg-green-500";
  return "bg-green-800 dark:bg-green-400";
}

export function ReadingHeatmap({ data }: ReadingHeatmapProps) {
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    const numWeeks = 53;
    const weeksArr: { date: string; minutes: number; dayOfWeek: number }[][] = [];
    const monthLabelPositions: { label: string; col: number }[] = [];

    // Start from (numWeeks * 7) days ago, aligned to Sunday
    const start = new Date(today);
    start.setDate(today.getDate() - (numWeeks * 7 - 1) - today.getDay());

    let currentMonth = -1;

    for (let w = 0; w < numWeeks; w++) {
      const week: { date: string; minutes: number; dayOfWeek: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);

        if (date > today) {
          week.push({ date: "", minutes: 0, dayOfWeek: d });
          continue;
        }

        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const minutes = data.get(dateStr) ?? 0;

        if (date.getMonth() !== currentMonth && d === 0) {
          currentMonth = date.getMonth();
          monthLabelPositions.push({ label: MONTH_LABELS[currentMonth], col: w });
        }

        week.push({ date: dateStr, minutes, dayOfWeek: d });
      }
      weeksArr.push(week);
    }

    return { weeks: weeksArr, monthLabels: monthLabelPositions };
  }, [data]);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">ปฏิทินการอ่าน</h3>
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Month labels */}
          <div className="flex ml-8 mb-1">
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="text-[10px] text-muted-foreground absolute"
                style={{ marginLeft: `${m.col * 14}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-0.5 mt-4">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1">
              {DAY_LABELS.map((label, i) => (
                <div key={i} className="h-[12px] w-6 text-[9px] text-muted-foreground flex items-center justify-end pr-1">
                  {i % 2 === 1 ? label : ""}
                </div>
              ))}
            </div>

            {/* Grid */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={`heatmap-cell h-[12px] w-[12px] ${day.date ? getIntensity(day.minutes) : "bg-transparent"}`}
                    title={day.date ? `${day.date}: ${Math.round(day.minutes)} นาที` : ""}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>น้อย</span>
            <div className="h-[10px] w-[10px] rounded-sm bg-muted" />
            <div className="h-[10px] w-[10px] rounded-sm bg-green-200 dark:bg-green-900" />
            <div className="h-[10px] w-[10px] rounded-sm bg-green-400 dark:bg-green-700" />
            <div className="h-[10px] w-[10px] rounded-sm bg-green-600 dark:bg-green-500" />
            <div className="h-[10px] w-[10px] rounded-sm bg-green-800 dark:bg-green-400" />
            <span>มาก</span>
          </div>
        </div>
      </div>
    </div>
  );
}
