import type { Book } from "./types";
import { db } from "./db";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function extractPdfMetadata(
  file: File
): Promise<{ title: string; author: string; totalPages: number; cover?: string }> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const metadata = await pdf.getMetadata();

  const info = metadata.info as Record<string, string> | null;
  const title = info?.Title || file.name.replace(/\.pdf$/i, "");
  const author = info?.Author || "";

  // Extract cover from first page
  let cover: string | undefined;
  try {
    const page = await pdf.getPage(1);
    const scale = 0.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    cover = canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    // ignore cover extraction failure
  }

  return { title, author, totalPages: pdf.numPages, cover };
}

export async function extractEpubMetadata(
  file: File
): Promise<{ title: string; author: string; cover?: string }> {
  const ePub = (await import("epubjs")).default;
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);

  try {
    await book.ready;
  } catch (err) {
    // If book.ready fails, try to get what we can
    console.warn("EPUB ready failed, using filename as fallback:", err);
    try { book.destroy(); } catch {}
    return {
      title: file.name.replace(/\.epub$/i, ""),
      author: "",
    };
  }

  const meta = book.packaging.metadata;
  const title = meta.title || file.name.replace(/\.epub$/i, "");
  const author = meta.creator || "";

  let cover: string | undefined;
  try {
    const coverUrl = await book.coverUrl();
    if (coverUrl) {
      // coverUrl returns an object URL (blob:) — fetch and convert to data URL
      const response = await fetch(coverUrl);
      const blob = await response.blob();
      cover = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      // Revoke the object URL to free memory
      URL.revokeObjectURL(coverUrl);
    }
  } catch {
    // ignore cover extraction failure
  }

  try {
    book.destroy();
  } catch {
    // ignore cleanup errors
  }

  return { title, author, cover };
}

export async function addBook(file: File): Promise<number> {
  const format = file.name.toLowerCase().endsWith(".epub") ? "epub" : "pdf";

  let title = file.name.replace(/\.(pdf|epub)$/i, "");
  let author = "";
  let totalPages: number | undefined;
  let cover: string | undefined;

  try {
    if (format === "pdf") {
      const meta = await extractPdfMetadata(file);
      title = meta.title;
      author = meta.author;
      totalPages = meta.totalPages;
      cover = meta.cover;
    } else {
      const meta = await extractEpubMetadata(file);
      title = meta.title;
      author = meta.author;
      cover = meta.cover;
    }
  } catch (err) {
    console.warn("Metadata extraction failed, using filename:", err);
    // use filename as fallback — already set above
  }

  const now = new Date();
  const bookId = await db.books.add({
    title,
    author,
    format,
    status: "unread",
    coverImage: cover,
    totalPages,
    fileSize: file.size,
    addedAt: now,
    updatedAt: now,
  });

  // Store the file as a Blob (not File) for better IndexedDB compatibility
  const blob = new Blob([await file.arrayBuffer()], { type: file.type || (format === "epub" ? "application/epub+zip" : "application/pdf") });
  await db.bookFiles.add({
    bookId: bookId as number,
    fileData: blob,
  });

  return bookId as number;
}

export async function deleteBook(bookId: number): Promise<void> {
  await db.transaction("rw", [db.books, db.bookFiles, db.readingProgress, db.bookmarks, db.highlights, db.vocabulary], async () => {
    await db.books.delete(bookId);
    await db.bookFiles.where("bookId").equals(bookId).delete();
    await db.readingProgress.where("bookId").equals(bookId).delete();
    await db.bookmarks.where("bookId").equals(bookId).delete();
    await db.highlights.where("bookId").equals(bookId).delete();
    await db.vocabulary.where("bookId").equals(bookId).delete();
  });
}

export async function getReadingBooks(): Promise<(Book & { progress?: number })[]> {
  const books = await db.books.where("status").equals("reading").toArray();
  const result = await Promise.all(
    books.map(async (book) => {
      const progress = await db.readingProgress
        .where("bookId")
        .equals(book.id!)
        .first();
      return { ...book, progress: progress?.percentage ?? 0 };
    })
  );
  return result;
}
