"use client";

import { useEffect, useRef } from "react";

interface UseSwipeOptions {
  /** Called when user swipes left (finger moves right-to-left) */
  onSwipeLeft?: () => void;
  /** Called when user swipes right (finger moves left-to-right) */
  onSwipeRight?: () => void;
  /** Called when user taps on left 25% of the element */
  onTapLeft?: () => void;
  /** Called when user taps on right 25% of the element */
  onTapRight?: () => void;
  /** Minimum swipe distance in px to trigger (default: 50) */
  threshold?: number;
  /** Maximum time in ms for a touch to count as a tap (default: 200) */
  tapMaxDuration?: number;
  /** Maximum movement in px for a touch to still count as a tap (default: 10) */
  tapMaxMovement?: number;
}

export function useSwipe(
  ref: React.RefObject<HTMLElement | null>,
  options: UseSwipeOptions
) {
  // Store options in a ref so event listeners always see latest values
  // without needing to re-attach on every options change
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const elapsed = Date.now() - touchStartTime;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      const opts = optionsRef.current;
      const threshold = opts.threshold ?? 50;
      const tapMaxDuration = opts.tapMaxDuration ?? 200;
      const tapMaxMovement = opts.tapMaxMovement ?? 10;

      // --- Swipe detection ---
      // Only trigger if horizontal movement dominates vertical
      if (absDeltaX > absDeltaY && absDeltaX >= threshold) {
        // Don't navigate if user has selected text
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return;

        if (deltaX < 0) {
          opts.onSwipeLeft?.();
        } else {
          opts.onSwipeRight?.();
        }
        return;
      }

      // --- Tap detection ---
      // Quick tap with minimal movement
      if (
        elapsed <= tapMaxDuration &&
        absDeltaX <= tapMaxMovement &&
        absDeltaY <= tapMaxMovement
      ) {
        // Don't navigate if user has selected text
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return;

        const rect = el.getBoundingClientRect();
        const tapX = touch.clientX - rect.left;
        const width = rect.width;

        if (tapX < width * 0.25) {
          opts.onTapLeft?.();
        } else if (tapX > width * 0.75) {
          opts.onTapRight?.();
        }
        // Taps in the middle 50% do nothing (allows normal interaction)
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref]);
}
