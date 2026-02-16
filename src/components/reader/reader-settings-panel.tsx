"use client";

import { useCallback } from "react";
import {
  Type,
  AlignJustify,
  Palette,
  RotateCcw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  type ReaderSettings,
  DEFAULTS,
  BG_PRESETS,
  saveReaderSettings,
} from "@/lib/reader-settings";

interface ReaderSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReaderSettings;
  onSettingsChange: (settings: ReaderSettings) => void;
}

const BG_LABEL: Record<ReaderSettings["bgPreset"], string> = {
  white: "ขาว",
  cream: "ครีม",
  dark: "มืด",
};

export function ReaderSettingsPanel({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: ReaderSettingsPanelProps) {
  const update = useCallback(
    (patch: Partial<ReaderSettings>) => {
      const next = { ...settings, ...patch };
      onSettingsChange(next);
      saveReaderSettings(next);
    },
    [settings, onSettingsChange]
  );

  const handleReset = useCallback(() => {
    onSettingsChange({ ...DEFAULTS });
    saveReaderSettings({ ...DEFAULTS });
  }, [onSettingsChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-72 sm:max-w-xs">
        <SheetHeader>
          <SheetTitle className="text-base">ตั้งค่าการอ่าน</SheetTitle>
          <SheetDescription className="sr-only">
            ปรับขนาดตัวอักษร ระยะห่างบรรทัด และพื้นหลัง
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4">
          {/* Font size */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Type className="h-4 w-4" />
              <span>ขนาดตัวอักษร</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={settings.fontSize <= 14}
                onClick={() =>
                  update({ fontSize: Math.max(14, settings.fontSize - 2) })
                }
              >
                <span className="text-lg font-bold">-</span>
              </Button>
              <span className="text-sm font-medium tabular-nums">
                {settings.fontSize}px
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={settings.fontSize >= 28}
                onClick={() =>
                  update({ fontSize: Math.min(28, settings.fontSize + 2) })
                }
              >
                <span className="text-lg font-bold">+</span>
              </Button>
            </div>
          </div>

          {/* Line height */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlignJustify className="h-4 w-4" />
              <span>ระยะห่างบรรทัด</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={settings.lineHeight <= 1.4}
                onClick={() =>
                  update({
                    lineHeight: Math.max(
                      1.4,
                      Math.round((settings.lineHeight - 0.2) * 10) / 10
                    ),
                  })
                }
              >
                <span className="text-lg font-bold">-</span>
              </Button>
              <span className="text-sm font-medium tabular-nums">
                {settings.lineHeight.toFixed(1)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={settings.lineHeight >= 2.4}
                onClick={() =>
                  update({
                    lineHeight: Math.min(
                      2.4,
                      Math.round((settings.lineHeight + 0.2) * 10) / 10
                    ),
                  })
                }
              >
                <span className="text-lg font-bold">+</span>
              </Button>
            </div>
          </div>

          {/* Background preset */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Palette className="h-4 w-4" />
              <span>พื้นหลัง</span>
            </div>
            <div className="flex items-center justify-center gap-4 py-1">
              {(Object.keys(BG_PRESETS) as ReaderSettings["bgPreset"][]).map(
                (preset) => (
                  <button
                    key={preset}
                    onClick={() => update({ bgPreset: preset })}
                    className="flex flex-col items-center gap-1"
                    title={BG_LABEL[preset]}
                  >
                    <div
                      className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: BG_PRESETS[preset].bg,
                        borderColor:
                          settings.bgPreset === preset
                            ? "var(--color-primary)"
                            : "var(--color-border)",
                      }}
                    >
                      {settings.bgPreset === preset && (
                        <Check
                          className="h-4 w-4"
                          style={{ color: BG_PRESETS[preset].text }}
                        />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {BG_LABEL[preset]}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Reset button */}
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-2"
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>รีเซ็ต</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
