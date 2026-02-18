const STORAGE_KEY = "speed-reader-documents";

export interface StoredDocument {
  id: string;
  filename: string;
  text: string;
  wordCount: number;
  currentWordIndex: number;
  wpm: number;
  lastReadAt: number;
  createdAt: number;
  hasPdfData?: boolean;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function getAllDocuments(): StoredDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredDocument[];
  } catch {
    return [];
  }
}

export function getDocument(id: string): StoredDocument | null {
  const docs = getAllDocuments();
  return docs.find((d) => d.id === id) ?? null;
}

export function saveDocument(
  filename: string,
  text: string,
  hasPdfData?: boolean
): StoredDocument {
  const docs = getAllDocuments();
  const words = text.split(/\s+/).filter(Boolean);
  const doc: StoredDocument = {
    id: generateId(),
    filename,
    text,
    wordCount: words.length,
    currentWordIndex: 0,
    wpm: 300,
    lastReadAt: Date.now(),
    createdAt: Date.now(),
    ...(hasPdfData ? { hasPdfData: true } : {}),
  };
  docs.unshift(doc);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  return doc;
}

export function updateDocument(
  id: string,
  updates: Partial<Pick<StoredDocument, "currentWordIndex" | "wpm" | "lastReadAt">>
): void {
  const docs = getAllDocuments();
  const idx = docs.findIndex((d) => d.id === id);
  if (idx === -1) return;
  docs[idx] = { ...docs[idx], ...updates, lastReadAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

export function deleteDocument(id: string): void {
  const doc = getDocument(id);
  const docs = getAllDocuments().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  if (doc?.hasPdfData) {
    import("./pdf-store").then((m) => m.deletePdfData(id)).catch(() => {});
  }
}

export function getCompletionPercentage(doc: StoredDocument): number {
  if (doc.wordCount === 0) return 0;
  return Math.round((doc.currentWordIndex / doc.wordCount) * 100);
}
