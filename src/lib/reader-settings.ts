import { db } from "@/lib/db";

export interface ReaderSettings {
  fontSize: number; // 14-28, default 16
  lineHeight: number; // 1.4-2.4, default 1.8
  bgPreset: "white" | "cream" | "dark"; // default "white"
}

export const DEFAULTS: ReaderSettings = {
  fontSize: 16,
  lineHeight: 1.8,
  bgPreset: "white",
};

export const BG_PRESETS: Record<
  ReaderSettings["bgPreset"],
  { bg: string; text: string }
> = {
  white: { bg: "#ffffff", text: "#1a1a1a" },
  cream: { bg: "#f5f0e8", text: "#3d3329" },
  dark: { bg: "#1a1a1a", text: "#d4d4d4" },
};

export async function getReaderSettings(): Promise<ReaderSettings> {
  try {
    const row = await db.appSettings.get("readerSettings");
    if (row) {
      return { ...DEFAULTS, ...JSON.parse(row.value) };
    }
  } catch {
    // ignore parse errors, return defaults
  }
  return { ...DEFAULTS };
}

export async function saveReaderSettings(
  settings: ReaderSettings
): Promise<void> {
  await db.appSettings.put({
    key: "readerSettings",
    value: JSON.stringify(settings),
  });
}
