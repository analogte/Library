import Dexie, { type Table } from "dexie";
import type {
  Book,
  BookFile,
  ReadingProgress,
  Bookmark,
  Highlight,
  VocabularyEntry,
  ReadingSession,
  BookNote,
  AppSetting,
} from "./types";

class LibraryDB extends Dexie {
  books!: Table<Book, number>;
  bookFiles!: Table<BookFile, number>;
  readingProgress!: Table<ReadingProgress, number>;
  bookmarks!: Table<Bookmark, number>;
  highlights!: Table<Highlight, number>;
  vocabulary!: Table<VocabularyEntry, number>;
  readingSessions!: Table<ReadingSession, number>;
  bookNotes!: Table<BookNote, number>;
  appSettings!: Table<AppSetting, string>;

  constructor() {
    super("PersonalLibraryDB");
    this.version(3).stores({
      books: "++id, title, author, format, status, addedAt, updatedAt",
      bookFiles: "++id, bookId",
      readingProgress: "++id, bookId",
      bookmarks: "++id, bookId, page",
      highlights: "++id, bookId, page",
      vocabulary: "++id, word, bookId, partOfSpeech, mastered, language, createdAt",
      appSettings: "key",
    });
    this.version(4).stores({
      books: "++id, title, author, format, status, addedAt, updatedAt",
      bookFiles: "++id, bookId",
      readingProgress: "++id, bookId",
      bookmarks: "++id, bookId, page",
      highlights: "++id, bookId, page",
      vocabulary: "++id, word, bookId, partOfSpeech, mastered, language, createdAt",
      readingSessions: "++id, bookId, startedAt, endedAt, durationMinutes",
      appSettings: "key",
    });
    this.version(5).stores({
      books: "++id, title, author, format, status, addedAt, updatedAt",
      bookFiles: "++id, bookId",
      readingProgress: "++id, bookId",
      bookmarks: "++id, bookId, page",
      highlights: "++id, bookId, page",
      vocabulary: "++id, word, bookId, partOfSpeech, mastered, language, createdAt",
      readingSessions: "++id, bookId, startedAt, endedAt, durationMinutes",
      bookNotes: "++id, bookId, createdAt, updatedAt",
      appSettings: "key",
    });
  }
}

export const db = new LibraryDB();
