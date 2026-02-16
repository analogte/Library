export interface Book {
  id?: number;
  title: string;
  author: string;
  format: "pdf" | "epub";
  genre?: string;
  tags?: string[];
  status: "unread" | "reading" | "finished";
  coverImage?: string; // base64 data URL
  totalPages?: number;
  fileSize?: number;
  addedAt: Date;
  updatedAt: Date;
}

export interface BookFile {
  id?: number;
  bookId: number;
  fileData: Blob;
}

export interface ReadingProgress {
  id?: number;
  bookId: number;
  currentPage: number;
  percentage: number;
  lastPosition?: string; // EPUB CFI or PDF page
  updatedAt: Date;
}

export interface Bookmark {
  id?: number;
  bookId: number;
  page: number;
  position?: string;
  label?: string;
  color: string;
  createdAt: Date;
}

export interface Highlight {
  id?: number;
  bookId: number;
  page: number;
  text: string;
  color: string;
  note?: string;
  cfiRange?: string; // EPUB CFI range
  createdAt: Date;
}

export type PartOfSpeech =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "pronoun"
  | "preposition"
  | "conjunction"
  | "interjection"
  | "phrase"
  | "idiom";

export const PART_OF_SPEECH_LABELS: Record<PartOfSpeech, string> = {
  noun: "คำนาม",
  verb: "คำกริยา",
  adjective: "คำคุณศัพท์",
  adverb: "คำกริยาวิเศษณ์",
  pronoun: "สรรพนาม",
  preposition: "คำบุพบท",
  conjunction: "คำสันธาน",
  interjection: "คำอุทาน",
  phrase: "วลี",
  idiom: "สำนวน",
};

export interface VocabularyEntry {
  id?: number;
  word: string;
  meaning: string;
  partOfSpeech?: PartOfSpeech;
  exampleSentence?: string;
  bookId?: number;
  bookTitle?: string;
  page?: number;
  language: string;
  mastered: boolean;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReadingSession {
  id?: number;
  bookId: number;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
}

export interface BookNote {
  id?: number;
  bookId: number;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppSetting {
  key: string;
  value: string;
}
