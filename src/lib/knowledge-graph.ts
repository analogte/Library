import { db } from "./db";

export interface BookConnection {
  bookA: { id: number; title: string };
  bookB: { id: number; title: string };
  sharedWords: string[];
  strength: number; // number of shared words
}

export interface ConnectedWord {
  word: string;
  bookIds: number[];
  bookTitles: string[];
  count: number;
}

export interface KnowledgeGraph {
  connections: BookConnection[];
  mostConnectedWords: ConnectedWord[];
  isolatedBooks: { id: number; title: string }[];
  totalBooks: number;
  totalVocab: number;
}

/** Build knowledge graph from shared vocabulary across books */
export async function buildKnowledgeGraph(): Promise<KnowledgeGraph> {
  const vocabulary = await db.vocabulary.toArray();
  const books = await db.books.toArray();

  const bookMap = new Map(books.map((b) => [b.id!, b.title]));
  const totalBooks = books.length;
  const totalVocab = vocabulary.length;

  // Group vocab by normalized word → set of bookIds
  const wordToBooks = new Map<string, Set<number>>();
  for (const v of vocabulary) {
    if (!v.bookId) continue;
    const word = v.word.toLowerCase().trim();
    if (!wordToBooks.has(word)) {
      wordToBooks.set(word, new Set());
    }
    wordToBooks.get(word)!.add(v.bookId);
  }

  // Find words that appear in multiple books
  const crossBookWords: ConnectedWord[] = [];
  for (const [word, bookIds] of wordToBooks) {
    if (bookIds.size >= 2) {
      const ids = Array.from(bookIds);
      crossBookWords.push({
        word,
        bookIds: ids,
        bookTitles: ids.map((id) => bookMap.get(id) ?? "Unknown"),
        count: bookIds.size,
      });
    }
  }

  // Sort by count (most connected first)
  crossBookWords.sort((a, b) => b.count - a.count);

  // Build book-to-book connections
  const connectionMap = new Map<string, { bookA: number; bookB: number; words: Set<string> }>();

  for (const cw of crossBookWords) {
    const ids = cw.bookIds;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${Math.min(ids[i], ids[j])}-${Math.max(ids[i], ids[j])}`;
        if (!connectionMap.has(key)) {
          connectionMap.set(key, {
            bookA: Math.min(ids[i], ids[j]),
            bookB: Math.max(ids[i], ids[j]),
            words: new Set(),
          });
        }
        connectionMap.get(key)!.words.add(cw.word);
      }
    }
  }

  // Convert to BookConnection array
  const connections: BookConnection[] = Array.from(connectionMap.values())
    .map((c) => ({
      bookA: { id: c.bookA, title: bookMap.get(c.bookA) ?? "Unknown" },
      bookB: { id: c.bookB, title: bookMap.get(c.bookB) ?? "Unknown" },
      sharedWords: Array.from(c.words),
      strength: c.words.size,
    }))
    .sort((a, b) => b.strength - a.strength);

  // Find isolated books (no connections)
  const connectedBookIds = new Set<number>();
  for (const c of connections) {
    connectedBookIds.add(c.bookA.id);
    connectedBookIds.add(c.bookB.id);
  }

  const isolatedBooks = books
    .filter((b) => b.id && !connectedBookIds.has(b.id))
    .map((b) => ({ id: b.id!, title: b.title }));

  return {
    connections,
    mostConnectedWords: crossBookWords.slice(0, 20),
    isolatedBooks,
    totalBooks,
    totalVocab,
  };
}
