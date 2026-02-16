"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  Languages,
  BookmarkPlus,
  Highlighter,
  Copy,
  Loader2,
  X,
  Plus,
  Volume2,
  VolumeX,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { translateText } from "@/lib/translate";
import { toast } from "sonner";

interface SelectionMenuProps {
  text: string;
  rect: DOMRect;
  onClose: () => void;
  onSaveVocab: (text: string, translation: string) => void;
  onHighlight?: (text: string) => void;
  onAskAI?: () => void;
}

export function SelectionMenu({
  text,
  rect,
  onClose,
  onSaveVocab,
  onHighlight,
  onAskAI,
}: SelectionMenuProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState("");
  const [detectedLang, setDetectedLang] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Calculate position — keep the entire menu within viewport
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const menuHeight = el.offsetHeight;
    const menuWidth = el.offsetWidth;
    const padding = 8;

    let left = rect.left + rect.width / 2 - menuWidth / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - menuWidth - padding));

    let top = rect.bottom + padding;
    if (top + menuHeight > window.innerHeight - padding) {
      top = rect.top - menuHeight - padding;
    }
    if (top < padding) {
      top = padding;
    }

    setPos({ top, left });
  }, [rect, showTranslation, translating, translation]);

  // Stop TTS on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleTranslate = async () => {
    setShowTranslation(true);
    setTranslating(true);
    try {
      const result = await translateText(text);
      setTranslation(result.translatedText);
      setDetectedLang(result.detectedLang ?? "");
    } catch {
      setTranslation("แปลไม่สำเร็จ");
    } finally {
      setTranslating(false);
    }
  };

  const handleSpeak = () => {
    if (!window.speechSynthesis) {
      toast.error("เบราว์เซอร์ไม่รองรับ Text-to-Speech");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    utterance.pitch = 1.0;

    // Pick the best English voice available
    const voices = window.speechSynthesis.getVoices();
    const preferredNames = [
      "Google US English",       // Chrome — natural
      "Google UK English Female", // Chrome — natural
      "Samantha",                // macOS — decent quality
      "Karen",                   // macOS — Australian
      "Daniel",                  // macOS — British
      "Moira",                   // macOS — Irish
    ];
    let bestVoice: SpeechSynthesisVoice | undefined;
    for (const name of preferredNames) {
      bestVoice = voices.find((v) => v.name === name);
      if (bestVoice) break;
    }
    // Fallback: any English voice
    if (!bestVoice) {
      bestVoice = voices.find((v) => v.lang.startsWith("en") && !v.localService) ??
                  voices.find((v) => v.lang.startsWith("en"));
    }
    if (bestVoice) utterance.voice = bestVoice;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    toast.success("คัดลอกแล้ว");
    onClose();
  };

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-selection-menu]")) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      data-selection-menu
      className="fixed z-50 max-w-md transition-opacity duration-100"
      style={{
        top: pos ? `${pos.top}px` : `${rect.bottom + 8}px`,
        left: pos ? `${pos.left}px` : `${rect.left}px`,
        opacity: pos ? 1 : 0,
      }}
    >
      {/* Translation popup */}
      {showTranslation && (
        <Card className="mb-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground line-clamp-2">
                {text}
              </p>
              {translating ? (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  กำลังแปล...
                </div>
              ) : (
                <>
                  <p className="mt-1 max-h-[30vh] overflow-y-auto text-sm font-medium">{translation}</p>
                  {detectedLang && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      ภาษาต้นทาง: {detectedLang}
                    </p>
                  )}
                </>
              )}
            </div>
            <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
          {!translating && translation && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full text-xs"
              onClick={() => onSaveVocab(text, translation)}
            >
              <Plus className="mr-1 h-3 w-3" />
              บันทึกคำศัพท์
            </Button>
          )}
        </Card>
      )}

      {/* Action buttons — 2 rows */}
      <Card className="p-1">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={handleTranslate}>
            <Languages className="mr-1 h-3.5 w-3.5" />
            แปล
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={handleSpeak}>
            {isSpeaking ? (
              <VolumeX className="mr-1 h-3.5 w-3.5" />
            ) : (
              <Volume2 className="mr-1 h-3.5 w-3.5" />
            )}
            ฟัง
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => onSaveVocab(text, translation)}
          >
            <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
            บันทึก
          </Button>
          {onHighlight && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => {
                onHighlight(text);
                onClose();
              }}
            >
              <Highlighter className="mr-1 h-3.5 w-3.5" />
              ไฮไลท์
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1 border-t mt-1 pt-1">
          {onAskAI && (
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={onAskAI}>
              <Bot className="mr-1 h-3.5 w-3.5" />
              ถาม AI
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={handleCopy}>
            <Copy className="mr-1 h-3.5 w-3.5" />
            คัดลอก
          </Button>
        </div>
      </Card>
    </div>
  );
}
