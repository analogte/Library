"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Message {
  role: "user" | "ai";
  content: string;
}

const QUICK_QUESTIONS = [
  "อธิบายให้เข้าใจง่าย",
  "สรุปสั้นๆ",
  "คำศัพท์ยากมีอะไรบ้าง",
  "แปลเป็นไทย",
  "อธิบายบริบทของข้อความนี้",
];

interface AiAssistantProps {
  selectedText: string;
  bookTitle: string;
  open: boolean;
  onClose: () => void;
}

export function AiAssistant({ selectedText, bookTitle, open, onClose }: AiAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when new text is selected
  useEffect(() => {
    if (open && selectedText) {
      setMessages([]);
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, selectedText]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const askGemini = async (question: string) => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return "Gemini API key ยังไม่ได้ตั้งค่า — ไปตั้งที่ .env.local";
    }

    const systemPrompt = `You are a reading assistant helping a Thai user understand English text from the book "${bookTitle}".
Always respond in Thai. Be concise and helpful. If the user asks to explain vocabulary, include the English word with Thai meaning.`;

    const prompt = `ข้อความที่เลือก:\n"${selectedText}"\n\nคำถาม: ${question}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\n" + prompt }] },
          ],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "ไม่มีคำตอบ";
  };

  const handleSend = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const answer = await askGemini(question);
      setMessages((prev) => [...prev, { role: "ai", content: answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" data-selection-menu>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <Card className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col sm:max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI Reading Assistant</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Selected text preview */}
        <div className="border-b bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">ข้อความที่เลือก:</p>
          <p className="mt-0.5 text-xs line-clamp-3">{selectedText}</p>
        </div>

        {/* Quick questions */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
              >
                <Sparkles className="mr-1 inline h-3 w-3" />
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                กำลังคิด...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ถามเกี่ยวกับข้อความนี้..."
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              disabled={loading}
            />
            <Button type="submit" size="sm" disabled={loading || !input.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
