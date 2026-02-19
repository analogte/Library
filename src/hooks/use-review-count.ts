"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

/** Reactive hook that returns the number of vocabulary items due for SM-2 review */
export function useReviewCount(): number {
  const count = useLiveQuery(async () => {
    const now = new Date();
    const unmastered = await db.vocabulary
      .where("mastered")
      .equals(0)
      .toArray();

    return unmastered.filter((v) => {
      if (!v.nextReviewAt) return true;
      return new Date(v.nextReviewAt) <= now;
    }).length;
  }, []);

  return count ?? 0;
}
