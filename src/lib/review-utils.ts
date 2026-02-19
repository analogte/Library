import { db } from "./db";
import type { VocabularyEntry } from "./types";

/** Get vocabulary items due for review (nextReviewAt <= now && !mastered) */
export async function getReviewQueue(): Promise<VocabularyEntry[]> {
  const now = new Date();
  const allVocab = await db.vocabulary
    .where("mastered")
    .equals(0)
    .toArray();

  return allVocab.filter((v) => {
    if (!v.nextReviewAt) return true; // never reviewed → include
    return new Date(v.nextReviewAt) <= now;
  });
}

/** Get count of items due for review */
export async function getReviewCount(): Promise<number> {
  const queue = await getReviewQueue();
  return queue.length;
}
