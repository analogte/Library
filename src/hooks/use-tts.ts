"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type TTSRate = 0.5 | 0.75 | 1 | 1.25 | 1.5;

const RATE_CYCLE: TTSRate[] = [0.75, 1, 1.25, 1.5, 0.5];

interface TTSState {
  text: string;
  isPlaying: boolean;
  isPaused: boolean;
  rate: TTSRate;
  lang: string;
}

/** Detect language from text using character ranges */
function detectLang(text: string): string {
  const thai = text.match(/[\u0E00-\u0E7F]/g)?.length ?? 0;
  const cjk = text.match(/[\u4E00-\u9FFF\u3040-\u30FF]/g)?.length ?? 0;
  const total = text.length;
  if (total === 0) return "en-US";
  if (thai / total > 0.3) return "th-TH";
  if (cjk / total > 0.3) return "ja-JP";
  return "en-US";
}

/** Pick the best voice for a given language */
function pickVoice(lang: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const langPrefix = lang.split("-")[0]; // "en", "th", "ja"

  const preferredNames: Record<string, string[]> = {
    en: [
      "Google US English",
      "Google UK English Female",
      "Samantha",
      "Karen",
      "Daniel",
      "Moira",
    ],
    th: [
      "Google \u0E44\u0E17\u0E22",
      "Kanya",
      "Niwat",
    ],
    ja: [
      "Google \u65E5\u672C\u8A9E",
      "Kyoko",
      "O-Ren",
    ],
  };

  const names = preferredNames[langPrefix] ?? [];

  // Try preferred names first
  for (const name of names) {
    const v = voices.find((v) => v.name === name);
    if (v) return v;
  }

  // Fallback: any remote voice for this lang, then any local voice
  return (
    voices.find((v) => v.lang.startsWith(langPrefix) && !v.localService) ??
    voices.find((v) => v.lang.startsWith(langPrefix))
  );
}

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    text: "",
    isPlaying: false,
    isPaused: false,
    rate: 1,
    lang: "en-US",
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Cancel on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const lang = detectLang(text);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;

    // Get current rate from state via functional update
    setState((prev) => {
      utterance.rate = prev.rate;
      return prev;
    });

    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const voice = pickVoice(lang, voices);
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      setState((prev) => ({ ...prev, isPlaying: false, isPaused: false, text: "" }));
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setState((prev) => ({ ...prev, isPlaying: false, isPaused: false, text: "" }));
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setState((prev) => ({ ...prev, text, isPlaying: true, isPaused: false, lang }));
  }, []);

  const pause = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.pause();
    setState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.resume();
    setState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const stop = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setState((prev) => ({ ...prev, isPlaying: false, isPaused: false, text: "" }));
  }, []);

  const togglePause = useCallback(() => {
    setState((prev) => {
      if (prev.isPaused) {
        window.speechSynthesis?.resume();
        return { ...prev, isPaused: false };
      } else {
        window.speechSynthesis?.pause();
        return { ...prev, isPaused: true };
      }
    });
  }, []);

  const cycleRate = useCallback(() => {
    setState((prev) => {
      const idx = RATE_CYCLE.indexOf(prev.rate);
      const nextRate = RATE_CYCLE[(idx + 1) % RATE_CYCLE.length];

      // If currently playing, restart with new rate
      if (prev.isPlaying && utteranceRef.current) {
        const text = prev.text;
        const lang = prev.lang;

        window.speechSynthesis?.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = nextRate;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis?.getVoices() ?? [];
        const voice = pickVoice(lang, voices);
        if (voice) utterance.voice = voice;

        utterance.onend = () => {
          setState((p) => ({ ...p, isPlaying: false, isPaused: false, text: "" }));
          utteranceRef.current = null;
        };
        utterance.onerror = () => {
          setState((p) => ({ ...p, isPlaying: false, isPaused: false, text: "" }));
          utteranceRef.current = null;
        };

        utteranceRef.current = utterance;
        window.speechSynthesis?.speak(utterance);

        return { ...prev, rate: nextRate, isPaused: false };
      }

      return { ...prev, rate: nextRate };
    });
  }, []);

  return {
    ...state,
    speak,
    pause,
    resume,
    stop,
    togglePause,
    cycleRate,
  };
}
