import Dexie, { type Table } from "dexie";
import type {
  Book,
  BookFile,
  ReadingProgress,
  Bookmark,
  Highlight,
  VocabularyEntry,
  AppSetting,
} from "./types";

class LibraryDB extends Dexie {
  books!: Table<Book, number>;
  bookFiles!: Table<BookFile, number>;
  readingProgress!: Table<ReadingProgress, number>;
  bookmarks!: Table<Bookmark, number>;
  highlights!: Table<Highlight, number>;
  vocabulary!: Table<VocabularyEntry, number>;
  appSettings!: Table<AppSetting, string>;

  constructor() {
    super("PersonalLibraryDB");
    this.version(1).stores({
      books: "++id, title, author, format, status, addedAt",
      bookFiles: "++id, bookId",
      readingProgress: "++id, bookId",
      bookmarks: "++id, bookId, page",
      highlights: "++id, bookId, page",
      vocabulary: "++id, word, bookId, partOfSpeech, mastered, language",
      appSettings: "key",
    });
  }
}

export const db = new LibraryDB();
