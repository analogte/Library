import { db } from "./db";

/** Generate Obsidian-compatible markdown for a single book */
export async function generateBookMarkdown(bookId: number): Promise<string> {
  const book = await db.books.get(bookId);
  if (!book) throw new Error("Book not found");

  const progress = await db.readingProgress.where("bookId").equals(bookId).first();
  const highlights = await db.highlights.where("bookId").equals(bookId).sortBy("page");
  const notes = await db.bookNotes.where("bookId").equals(bookId).sortBy("createdAt");
  const vocabulary = await db.vocabulary.where("bookId").equals(bookId).sortBy("createdAt");
  const sessions = await db.readingSessions.where("bookId").equals(bookId).toArray();

  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const exportDate = new Date().toISOString().split("T")[0];

  const lines: string[] = [];

  // YAML frontmatter
  lines.push("---");
  lines.push(`title: "${book.title.replace(/"/g, '\\"')}"`);
  lines.push(`author: "${(book.author || "Unknown").replace(/"/g, '\\"')}"`);
  lines.push(`format: ${book.format}`);
  lines.push(`status: ${book.status}`);
  lines.push(`progress: ${progress ? Math.round(progress.percentage) : 0}%`);
  lines.push(`total_pages: ${book.totalPages ?? "unknown"}`);
  lines.push(`reading_time: ${Math.round(totalMinutes)} minutes`);
  lines.push(`vocab_count: ${vocabulary.length}`);
  lines.push(`export_date: ${exportDate}`);
  lines.push(`tags: [book, personal-library]`);
  lines.push("---");
  lines.push("");

  // Title
  lines.push(`# ${book.title}`);
  lines.push(`*${book.author || "Unknown author"}*`);
  lines.push("");

  // Highlights
  if (highlights.length > 0) {
    lines.push("## Highlights");
    lines.push("");

    // Group by page
    const byPage = new Map<number, typeof highlights>();
    for (const h of highlights) {
      const arr = byPage.get(h.page) ?? [];
      arr.push(h);
      byPage.set(h.page, arr);
    }

    for (const [page, pageHighlights] of byPage) {
      lines.push(`### Page ${page}`);
      for (const h of pageHighlights) {
        lines.push(`> ${h.text}`);
        if (h.note) lines.push(`> — *${h.note}*`);
        lines.push("");
      }
    }
  }

  // Notes
  if (notes.length > 0) {
    lines.push("## Notes");
    lines.push("");
    for (const note of notes) {
      const typeTag = note.type === "ai-summary" ? " `AI`" : "";
      lines.push(`### ${note.title || "Untitled"}${typeTag}`);
      if (note.pageLabel) lines.push(`*${note.pageLabel}*`);
      if (note.highlightText) {
        lines.push(`> ${note.highlightText}`);
        lines.push("");
      }
      lines.push(note.content);
      lines.push("");
    }
  }

  // Vocabulary
  if (vocabulary.length > 0) {
    lines.push("## Vocabulary");
    lines.push("");
    lines.push("| Word | Meaning | POS | Mastered |");
    lines.push("|------|---------|-----|----------|");
    for (const v of vocabulary) {
      const pos = v.partOfSpeech ?? "-";
      const mastered = v.mastered ? "Yes" : "No";
      lines.push(`| ${v.word} | ${v.meaning} | ${pos} | ${mastered} |`);
    }
    lines.push("");
  }

  // Reading Stats
  lines.push("## Reading Stats");
  lines.push("");
  lines.push(`- **Total Reading Time:** ${Math.round(totalMinutes)} minutes`);
  lines.push(`- **Sessions:** ${sessions.length}`);
  lines.push(`- **Progress:** ${progress ? Math.round(progress.percentage) : 0}%`);
  lines.push(`- **Highlights:** ${highlights.length}`);
  lines.push(`- **Notes:** ${notes.length}`);
  lines.push(`- **Vocabulary:** ${vocabulary.length}`);
  lines.push("");
  lines.push(`---`);
  lines.push(`*Exported from Personal Library on ${exportDate}*`);

  return lines.join("\n");
}

/** Generate markdown for all books */
export async function generateAllBooksMarkdown(): Promise<{ filename: string; content: string }[]> {
  const books = await db.books.toArray();
  const results: { filename: string; content: string }[] = [];

  for (const book of books) {
    if (!book.id) continue;
    const content = await generateBookMarkdown(book.id);
    const safeName = book.title.replace(/[/\\?%*:|"<>]/g, "-").substring(0, 100);
    results.push({ filename: `${safeName}.md`, content });
  }

  return results;
}

/** Download a single markdown file */
export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
