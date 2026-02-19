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
  TranslationCacheEntry,
  QuizSession,
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
  translationCache!: Table<TranslationCacheEntry>;
  quizSessions!: Table<QuizSession, number>;

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
    this.version(6).stores({
      books: "++id, title, author, format, status, addedAt, updatedAt",
      bookFiles: "++id, bookId",
      readingProgress: "++id, bookId",
      bookmarks: "++id, bookId, page",
      highlights: "++id, bookId, page",
      vocabulary: "++id, word, bookId, partOfSpeech, mastered, language, createdAt",
      readingSessions: "++id, bookId, startedAt, endedAt, durationMinutes",
      bookNotes: "++id, bookId, createdAt, updatedAt",
      appSettings: "key",
      translationCache: "[engine+targetLang+text], createdAt",
    });
    this.version(7).stores({
      books: "++id, title, author, format, status, addedAt, updatedAt",
      bookFiles: "++id, bookId",
      readingProgress: "++id, bookId",
      bookmarks: "++id, bookId, page",
      highlights: "++id, bookId, page",
      vocabulary: "++id, word, bookId, partOfSpeech, mastered, language, createdAt",
      readingSessions: "++id, bookId, startedAt, endedAt, durationMinutes",
      bookNotes: "++id, bookId, page, createdAt, updatedAt",
      appSettings: "key",
      translationCache: "[engine+targetLang+text], createdAt",
    });
    this.version(8).stores({
      books: "++id, title, author, format, status, addedAt, updatedAt",
      bookFiles: "++id, bookId",
      readingProgress: "++id, bookId",
      bookmarks: "++id, bookId, page",
      highlights: "++id, bookId, page",
      vocabulary: "++id, word, bookId, partOfSpeech, mastered, language, createdAt, nextReviewAt",
      readingSessions: "++id, bookId, startedAt, endedAt, durationMinutes",
      bookNotes: "++id, bookId, page, type, createdAt, updatedAt",
      appSettings: "key",
      translationCache: "[engine+targetLang+text], createdAt",
      quizSessions: "++id, date, createdAt",
    }).upgrade(tx => {
      return tx.table("vocabulary").toCollection().modify(vocab => {
        if (!vocab.mastered && !vocab.nextReviewAt) {
          vocab.nextReviewAt = new Date();
          vocab.interval = 0;
          vocab.easeFactor = 2.5;
          vocab.repetitions = 0;
        }
      });
    });
  }
}

export const db = new LibraryDB();
