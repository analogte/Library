import { db } from "./db";

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Heatmap data: Map<"YYYY-MM-DD", minutes> for last 365 days */
export async function getReadingHeatmapData(): Promise<Map<string, number>> {
  const sessions = await db.readingSessions.toArray();
  const map = new Map<string, number>();

  for (const s of sessions) {
    const dateStr = formatDate(new Date(s.startedAt));
    map.set(dateStr, (map.get(dateStr) ?? 0) + s.durationMinutes);
  }

  return map;
}

/** Weekly reading data for last 12 weeks */
export async function getWeeklyReadingData(): Promise<{ week: string; minutes: number }[]> {
  const sessions = await db.readingSessions.toArray();
  const now = new Date();
  const weeks: { week: string; minutes: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekLabel = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
    let totalMinutes = 0;

    for (const s of sessions) {
      const startedAt = new Date(s.startedAt);
      if (startedAt >= weekStart && startedAt < weekEnd) {
        totalMinutes += s.durationMinutes;
      }
    }

    weeks.push({ week: weekLabel, minutes: Math.round(totalMinutes) });
  }

  return weeks;
}

/** Cumulative vocab growth over last 12 weeks */
export async function getVocabGrowthData(): Promise<{ week: string; total: number }[]> {
  const vocab = await db.vocabulary.orderBy("createdAt").toArray();
  const now = new Date();
  const weeks: { week: string; total: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - now.getDay() - i * 7 + 7);
    weekEnd.setHours(0, 0, 0, 0);

    const weekLabel = `${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
    const count = vocab.filter((v) => new Date(v.createdAt) <= weekEnd).length;
    weeks.push({ week: weekLabel, total: count });
  }

  return weeks;
}

/** Streak data: current streak and longest streak */
export async function getStreakData(): Promise<{ current: number; longest: number }> {
  const sessions = await db.readingSessions.toArray();
  if (sessions.length === 0) return { current: 0, longest: 0 };

  const dateSet = new Set<string>();
  for (const s of sessions) {
    dateSet.add(formatDate(new Date(s.startedAt)));
  }

  const sortedDates = Array.from(dateSet).sort().reverse();
  const today = formatDate(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  // Current streak
  let current = 0;
  if (sortedDates[0] === today || sortedDates[0] === yesterdayStr) {
    current = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const curr = new Date(sortedDates[i - 1]);
      const prev = new Date(sortedDates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) current++;
      else break;
    }
  }

  // Longest streak
  const allDates = Array.from(dateSet).sort();
  let longest = 0;
  let streak = 1;
  for (let i = 1; i < allDates.length; i++) {
    const curr = new Date(allDates[i]);
    const prev = new Date(allDates[i - 1]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
    } else {
      if (streak > longest) longest = streak;
      streak = 1;
    }
  }
  if (streak > longest) longest = streak;

  return { current, longest };
}

/** Reading insights */
export async function getReadingInsights(): Promise<{
  peakHour: string;
  avgSessionMinutes: number;
  favoriteBook: string | null;
}> {
  const sessions = await db.readingSessions.toArray();
  if (sessions.length === 0) {
    return { peakHour: "-", avgSessionMinutes: 0, favoriteBook: null };
  }

  // Peak hour
  const hourCounts = new Map<number, number>();
  for (const s of sessions) {
    const hour = new Date(s.startedAt).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  let peakHour = 0;
  let maxCount = 0;
  hourCounts.forEach((count, hour) => {
    if (count > maxCount) {
      maxCount = count;
      peakHour = hour;
    }
  });

  // Average session
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const avgSessionMinutes = Math.round(totalMinutes / sessions.length);

  // Favorite book (most sessions)
  const bookCounts = new Map<number, number>();
  for (const s of sessions) {
    bookCounts.set(s.bookId, (bookCounts.get(s.bookId) ?? 0) + 1);
  }
  let favBookId = 0;
  let favCount = 0;
  bookCounts.forEach((count, bookId) => {
    if (count > favCount) {
      favCount = count;
      favBookId = bookId;
    }
  });
  const favBook = favBookId ? await db.books.get(favBookId) : null;

  return {
    peakHour: `${String(peakHour).padStart(2, "0")}:00`,
    avgSessionMinutes,
    favoriteBook: favBook?.title ?? null,
  };
}

/** Monthly comparison: this month vs last month */
export async function getMonthlyComparison(): Promise<{
  thisMonth: number;
  lastMonth: number;
  changePercent: number;
}> {
  const sessions = await db.readingSessions.toArray();
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let thisMonth = 0;
  let lastMonth = 0;

  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (d >= thisMonthStart) {
      thisMonth += s.durationMinutes;
    } else if (d >= lastMonthStart && d < thisMonthStart) {
      lastMonth += s.durationMinutes;
    }
  }

  const changePercent = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : thisMonth > 0 ? 100 : 0;

  return {
    thisMonth: Math.round(thisMonth),
    lastMonth: Math.round(lastMonth),
    changePercent,
  };
}
