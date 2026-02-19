/**
 * SM-2 Spaced Repetition Algorithm
 * Based on: https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
 *
 * quality: 0-5 (0=complete blackout, 5=perfect response)
 *   >= 3 = successful recall
 *   < 3 = reset repetitions
 */

export interface SM2Input {
  quality: number;       // 0-5
  repetitions: number;   // current repetition count
  easeFactor: number;    // current ease factor (min 1.3)
  interval: number;      // current interval in days
}

export interface SM2Result {
  nextReviewAt: Date;
  interval: number;      // new interval in days
  easeFactor: number;    // new ease factor
  repetitions: number;   // new repetition count
}

export function calculateSM2({
  quality,
  repetitions,
  easeFactor,
  interval,
}: SM2Input): SM2Result {
  let newEF = easeFactor;
  let newInterval: number;
  let newReps: number;

  if (quality >= 3) {
    // Successful recall
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newReps = repetitions + 1;
  } else {
    // Failed — reset
    newInterval = 1;
    newReps = 0;
  }

  // Update ease factor
  newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEF < 1.3) newEF = 1.3;

  // Calculate next review date
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);
  nextReviewAt.setHours(0, 0, 0, 0);

  return {
    nextReviewAt,
    interval: newInterval,
    easeFactor: Math.round(newEF * 100) / 100,
    repetitions: newReps,
  };
}

/** Get default SM-2 values for a new vocabulary entry */
export function getDefaultSM2() {
  return {
    nextReviewAt: new Date(),
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
  };
}
