export async function translateText(
  text: string,
  targetLang: string = "th"
): Promise<{ translatedText: string; detectedLang?: string }> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Translation failed");

  const data = await response.json();
  const translatedText = data[0]
    ?.map((item: [string]) => item[0])
    .join("") as string;
  const detectedLang = data[2] as string | undefined;

  return { translatedText, detectedLang };
}
