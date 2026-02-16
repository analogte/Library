import { db } from "./db";

export type TranslateEngine = "google" | "gemini";

const translationCache = new Map<string, { translatedText: string; detectedLang?: string }>();
const MAX_CACHE_SIZE = 500;

export async function getTranslateEngine(): Promise<TranslateEngine> {
  const setting = await db.appSettings.get("translateEngine");
  return (setting?.value as TranslateEngine) ?? "google";
}

export async function setTranslateEngine(engine: TranslateEngine): Promise<void> {
  await db.appSettings.put({ key: "translateEngine", value: engine });
}

async function translateWithGoogle(
  text: string,
  targetLang: string
): Promise<{ translatedText: string; detectedLang?: string }> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Google Translate failed");

  const data = await response.json();
  const translatedText = data[0]
    ?.map((item: [string]) => item[0])
    .join("") as string;
  const detectedLang = data[2] as string | undefined;

  return { translatedText, detectedLang };
}

async function translateWithGemini(
  text: string,
  targetLang: string
): Promise<{ translatedText: string; detectedLang?: string }> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const langName = targetLang === "th" ? "Thai" : targetLang;
  const prompt = `Translate the following text to ${langName}. Return ONLY the translation, nothing else.\n\nText: ${text}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await response.json();
  const translatedText =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  return { translatedText, detectedLang: "AI" };
}

export async function translateText(
  text: string,
  targetLang: string = "th"
): Promise<{ translatedText: string; detectedLang?: string }> {
  const engine = await getTranslateEngine();
  const cacheKey = `${engine}:${targetLang}:${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  const result =
    engine === "gemini"
      ? await translateWithGemini(text, targetLang)
      : await translateWithGoogle(text, targetLang);

  // Evict oldest entries if cache is full
  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey !== undefined) translationCache.delete(firstKey);
  }
  translationCache.set(cacheKey, result);

  return result;
}
