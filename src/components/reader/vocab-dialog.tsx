"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/db";
import { lookupWord } from "@/lib/translate";
import { PART_OF_SPEECH_LABELS } from "@/lib/types";
import type { PartOfSpeech } from "@/lib/types";
import { toast } from "sonner";

interface VocabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: string;
  meaning: string;
  bookId?: number;
  bookTitle?: string;
  page?: number;
}

export function VocabDialog({
  open,
  onOpenChange,
  word: initialWord,
  meaning: initialMeaning,
  bookId,
  bookTitle,
  page,
}: VocabDialogProps) {
  const [word, setWord] = useState(initialWord);
  const [meaning, setMeaning] = useState(initialMeaning);
  const [partOfSpeech, setPartOfSpeech] = useState<string>("");
  const [example, setExample] = useState("");
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // Reset when props change
  useEffect(() => {
    setWord(initialWord);
    setMeaning(initialMeaning);
  }, [initialWord, initialMeaning]);

  // Auto-lookup POS + example when dialog opens with a word
  useEffect(() => {
    if (!open || !initialWord.trim()) return;
    // Reset fields for new word
    setPartOfSpeech("");
    setExample("");

    let cancelled = false;
    setLookingUp(true);
    lookupWord(initialWord.trim()).then((result) => {
      if (cancelled) return;
      if (result.partOfSpeech) {
        // Map dictionary POS to our keys (e.g. "noun" → "noun")
        const posKey = result.partOfSpeech.toLowerCase();
        if (posKey in PART_OF_SPEECH_LABELS) {
          setPartOfSpeech(posKey);
        }
      }
      if (result.example) {
        setExample(result.example);
      }
    }).finally(() => {
      if (!cancelled) setLookingUp(false);
    });

    return () => { cancelled = true; };
  }, [open, initialWord]);

  const handleSave = async () => {
    if (!word.trim()) {
      toast.error("กรุณาใส่คำศัพท์");
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      await db.vocabulary.add({
        word: word.trim(),
        meaning: meaning.trim(),
        partOfSpeech: partOfSpeech as PartOfSpeech || undefined,
        exampleSentence: example.trim() || undefined,
        bookId,
        bookTitle,
        page,
        language: "en",
        mastered: false,
        createdAt: now,
        updatedAt: now,
      });
      toast.success(`บันทึก "${word}" แล้ว`);
      onOpenChange(false);
      // Reset
      setWord("");
      setMeaning("");
      setPartOfSpeech("");
      setExample("");
    } catch {
      toast.error("บันทึกล้มเหลว");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>บันทึกคำศัพท์</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">คำศัพท์</label>
            <Input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="เช่น serendipity"
            />
          </div>
          <div>
            <label className="text-sm font-medium">ความหมาย</label>
            <Textarea
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="ความหมายเป็นภาษาไทย..."
              rows={2}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">ชนิดคำ</label>
              {lookingUp && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <Select value={partOfSpeech} onValueChange={setPartOfSpeech}>
              <SelectTrigger>
                <SelectValue placeholder={lookingUp ? "กำลังค้นหา..." : "เลือกชนิดคำ (ไม่บังคับ)"} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PART_OF_SPEECH_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label} ({key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">ตัวอย่างประโยค</label>
              {lookingUp && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <Textarea
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder={lookingUp ? "กำลังค้นหาตัวอย่าง..." : "ประโยคตัวอย่าง (ไม่บังคับ)"}
              rows={2}
            />
          </div>
          {bookTitle && (
            <p className="text-xs text-muted-foreground">
              จากหนังสือ: {bookTitle} {page ? `หน้า ${page}` : ""}
            </p>
          )}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "กำลังบันทึก..." : "บันทึกคำศัพท์"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
