export interface ChapterSummary {
  tldr: string;
  keyConcepts: string[];
  reviewQuestions: string[];
}

/** Generate chapter summary using Gemini API */
export async function generateChapterSummary(
  text: string,
  bookTitle: string
): Promise<ChapterSummary> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key ยังไม่ได้ตั้งค่า — ไปตั้งที่ .env.local");
  }

  // Truncate text to ~8000 chars
  const truncated = text.length > 8000 ? text.slice(0, 8000) + "..." : text;

  const prompt = `You are a reading assistant. Analyze the following text from the book "${bookTitle}" and provide a structured summary.

Text:
"""
${truncated}
"""

Respond in Thai. Return ONLY valid JSON in this exact format:
{"tldr":"สรุปสั้นๆ 2-3 ประโยค","keyConcepts":["แนวคิด 1","แนวคิด 2","แนวคิด 3"],"reviewQuestions":["คำถาม 1?","คำถาม 2?","คำถาม 3?"]}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  // Extract JSON from response (may have markdown code fences)
  const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(jsonStr);

  return {
    tldr: parsed.tldr || "ไม่สามารถสรุปได้",
    keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
    reviewQuestions: Array.isArray(parsed.reviewQuestions) ? parsed.reviewQuestions : [],
  };
}
