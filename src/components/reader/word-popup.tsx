"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Loader2, Plus, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { translateText } from "@/lib/translate";

interface WordPopupProps {
  word: string;
  rect: DOMRect;
  onClose: () => void;
  onSaveVocab: (word: string, translation: string) => void;
  onSpeak?: (text: string) => void;
}

export function WordPopup({ word, rect, onClose, onSaveVocab, onSpeak }: WordPopupProps) {
  const [translating, setTranslating] = useState(true);
  const [translation, setTranslation] = useState("");
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Translate on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await translateText(word);
        if (!cancelled) {
          setTranslation(result.translatedText);
        }
      } catch {
        if (!cancelled) {
          setTranslation("แปลไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [word]);

  // Position calculation
  useLayoutEffect(() => {
    const el = popupRef.current;
    if (!el) return;

    const padding = 8;
    const popupWidth = el.offsetWidth;
    const popupHeight = el.offsetHeight;

    let left = rect.left + rect.width / 2 - popupWidth / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - popupWidth - padding));

    let top = rect.bottom + padding;
    if (top + popupHeight > window.innerHeight - padding) {
      top = rect.top - popupHeight - padding;
    }
    if (top < padding) top = padding;

    setPos({ top, left });
  }, [rect, translating, translation]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-word-popup]") && !target.closest("[data-selection-menu]")) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      data-word-popup
      data-selection-menu
      className="fixed z-50 transition-opacity duration-100"
      style={{
        top: pos ? `${pos.top}px` : `${rect.bottom + 8}px`,
        left: pos ? `${pos.left}px` : `${rect.left}px`,
        opacity: pos ? 1 : 0,
      }}
    >
      <Card className="min-w-[180px] max-w-[280px] p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">{word}</p>
              {onSpeak && (
                <button
                  onClick={() => onSpeak(word)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  title="ฟังเสียง"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {translating ? (
              <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                กำลังแปล...
              </div>
            ) : (
              <p className="mt-1 text-sm">{translation}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        {!translating && translation && translation !== "แปลไม่สำเร็จ" && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full text-xs"
            onClick={() => onSaveVocab(word, translation)}
          >
            <Plus className="mr-1 h-3 w-3" />
            บันทึกคำศัพท์
          </Button>
        )}
      </Card>
    </div>
  );
}

/** Extract the word at given coordinates from a document */
export function getWordAtPoint(
  doc: Document,
  x: number,
  y: number
): { word: string; rect: DOMRect } | null {
  // caretRangeFromPoint is widely supported but non-standard
  if (!("caretRangeFromPoint" in doc)) return null;

  const range = doc.caretRangeFromPoint(x, y);
  if (!range || !range.startContainer || range.startContainer.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  const textNode = range.startContainer as Text;
  const text = textNode.textContent ?? "";
  const offset = range.startOffset;

  // Expand to word boundaries
  let start = offset;
  let end = offset;

  // Word chars: letters, numbers, accented chars, CJK, Thai, etc.
  const isWordChar = (ch: string) => /[\p{L}\p{N}'-]/u.test(ch);

  while (start > 0 && isWordChar(text[start - 1])) start--;
  while (end < text.length && isWordChar(text[end])) end++;

  const word = text.slice(start, end).trim();
  if (!word || word.length < 1) return null;

  // Get bounding rect for the word
  const wordRange = doc.createRange();
  wordRange.setStart(textNode, start);
  wordRange.setEnd(textNode, end);
  const rect = wordRange.getBoundingClientRect();

  return { word, rect };
}
