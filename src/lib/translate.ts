import { db } from "./db";

export type TranslateEngine = "google" | "gemini";

export const TARGET_LANGUAGES = [
  { code: "th", label: "ไทย" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ko", label: "한국어" },
] as const;

export type TargetLangCode = (typeof TARGET_LANGUAGES)[number]["code"];

// In-memory cache (fast, per-session)
const memoryCache = new Map<string, { translatedText: string; detectedLang?: string }>();
const MAX_MEMORY_CACHE = 500;
const MAX_DB_CACHE = 2000;

// --- Engine setting ---

export async function getTranslateEngine(): Promise<TranslateEngine> {
  const setting = await db.appSettings.get("translateEngine");
  return (setting?.value as TranslateEngine) ?? "google";
}

export async function setTranslateEngine(engine: TranslateEngine): Promise<void> {
  await db.appSettings.put({ key: "translateEngine", value: engine });
}

// --- Target language setting ---

export async function getTargetLanguage(): Promise<TargetLangCode> {
  const setting = await db.appSettings.get("targetLanguage");
  return (setting?.value as TargetLangCode) ?? "th";
}

export async function setTargetLanguage(lang: TargetLangCode): Promise<void> {
  await db.appSettings.put({ key: "targetLanguage", value: lang });
}

// --- Translation engines ---

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

  const langLabel = TARGET_LANGUAGES.find((l) => l.code === targetLang)?.label ?? targetLang;
  const prompt = `Translate the following text to ${langLabel}. Return ONLY the translation, nothing else.\n\nText: ${text}`;

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

// --- IndexedDB cache helpers ---

async function getFromDbCache(
  engine: string,
  targetLang: string,
  text: string
): Promise<{ translatedText: string; detectedLang?: string } | null> {
  try {
    const entry = await db.translationCache.get({ engine, targetLang, text });
    return entry ? { translatedText: entry.translatedText, detectedLang: entry.detectedLang } : null;
  } catch {
    return null;
  }
}

function writeToDbCache(
  engine: string,
  targetLang: string,
  text: string,
  translatedText: string,
  detectedLang?: string
): void {
  // Fire-and-forget — don't await
  (async () => {
    try {
      await db.translationCache.put({
        engine,
        targetLang,
        text,
        translatedText,
        detectedLang,
        createdAt: new Date(),
      });

      // Evict oldest entries if over limit
      const count = await db.translationCache.count();
      if (count > MAX_DB_CACHE) {
        const toDelete = count - MAX_DB_CACHE;
        const oldest = await db.translationCache.orderBy("createdAt").limit(toDelete).primaryKeys();
        await db.translationCache.bulkDelete(oldest);
      }
    } catch {
      // Cache write failure is non-critical
    }
  })();
}

// --- Word lookup (POS + example sentence) ---

export interface WordLookupResult {
  partOfSpeech?: string;
  example?: string;
}

/** Look up part of speech + example via Free Dictionary API, fallback to Gemini */
export async function lookupWord(word: string): Promise<WordLookupResult> {
  // 1) Try Free Dictionary API (fast, free, no key)
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
    );
    if (res.ok) {
      const data = await res.json();
      const meanings = data?.[0]?.meanings;
      if (meanings?.length) {
        const m = meanings[0];
        const pos = m.partOfSpeech as string | undefined;
        const example = m.definitions?.[0]?.example as string | undefined;
        return { partOfSpeech: pos, example };
      }
    }
  } catch {
    // Dictionary failed, try Gemini
  }

  // 2) Fallback: Gemini
  try {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return {};

    const prompt = `For the English word "${word}", provide:
1. Part of speech (one of: noun, verb, adjective, adverb, pronoun, preposition, conjunction, interjection, phrase, idiom)
2. A short example sentence using this word

Respond in EXACTLY this JSON format, nothing else:
{"pos":"noun","example":"The machine learned to recognize patterns."}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        }),
      }
    );

    if (!res.ok) return {};

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    // Extract JSON from response (may have markdown code fences)
    const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    return {
      partOfSpeech: parsed.pos || undefined,
      example: parsed.example || undefined,
    };
  } catch {
    return {};
  }
}

// --- Main translate function ---

export async function translateText(
  text: string,
  targetLang?: string
): Promise<{ translatedText: string; detectedLang?: string }> {
  // Resolve target language from DB setting if not provided
  const lang = targetLang ?? (await getTargetLanguage());
  const engine = await getTranslateEngine();
  const cacheKey = `${engine}:${lang}:${text}`;

  // 1) In-memory cache
  const memCached = memoryCache.get(cacheKey);
  if (memCached) return memCached;

  // 2) IndexedDB cache
  const dbCached = await getFromDbCache(engine, lang, text);
  if (dbCached) {
    // Promote to memory cache
    if (memoryCache.size >= MAX_MEMORY_CACHE) {
      const firstKey = memoryCache.keys().next().value;
      if (firstKey !== undefined) memoryCache.delete(firstKey);
    }
    memoryCache.set(cacheKey, dbCached);
    return dbCached;
  }

  // 3) Call primary engine, fallback on failure
  const fallbackEngine: TranslateEngine = engine === "gemini" ? "google" : "gemini";
  let result: { translatedText: string; detectedLang?: string };

  try {
    result = engine === "gemini"
      ? await translateWithGemini(text, lang)
      : await translateWithGoogle(text, lang);
  } catch (primaryError) {
    // Try fallback engine
    try {
      result = fallbackEngine === "gemini"
        ? await translateWithGemini(text, lang)
        : await translateWithGoogle(text, lang);
    } catch {
      // Both failed — re-throw original error
      throw primaryError;
    }
  }

  // Write to both caches
  if (memoryCache.size >= MAX_MEMORY_CACHE) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey !== undefined) memoryCache.delete(firstKey);
  }
  memoryCache.set(cacheKey, result);
  writeToDbCache(engine, lang, text, result.translatedText, result.detectedLang);

  return result;
}
