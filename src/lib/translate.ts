const translationCache = new Map<string, { translatedText: string; detectedLang?: string }>();
const MAX_CACHE_SIZE = 500;

export async function translateText(
  text: string,
  targetLang: string = "th"
): Promise<{ translatedText: string; detectedLang?: string }> {
  const cacheKey = `${targetLang}:${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Translation failed");

  const data = await response.json();
  const translatedText = data[0]
    ?.map((item: [string]) => item[0])
    .join("") as string;
  const detectedLang = data[2] as string | undefined;

  const result = { translatedText, detectedLang };

  // Evict oldest entries if cache is full
  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey !== undefined) translationCache.delete(firstKey);
  }
  translationCache.set(cacheKey, result);

  return result;
}
