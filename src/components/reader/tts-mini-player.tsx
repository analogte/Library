"use client";

import { Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TTSRate } from "@/hooks/use-tts";

interface TTSMiniPlayerProps {
  text: string;
  isPlaying: boolean;
  isPaused: boolean;
  rate: TTSRate;
  onTogglePause: () => void;
  onCycleRate: () => void;
  onStop: () => void;
}

export function TTSMiniPlayer({
  text,
  isPlaying,
  isPaused,
  rate,
  onTogglePause,
  onCycleRate,
  onStop,
}: TTSMiniPlayerProps) {
  if (!isPlaying) return null;

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-t bg-background/80 backdrop-blur-sm px-3 py-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onTogglePause}
      >
        {isPaused ? (
          <Play className="h-4 w-4" />
        ) : (
          <Pause className="h-4 w-4" />
        )}
      </Button>

      <p className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
        {text}
      </p>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 px-2 text-xs font-mono tabular-nums"
        onClick={onCycleRate}
      >
        {rate}x
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onStop}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
