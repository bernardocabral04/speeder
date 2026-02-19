const STORAGE_KEY = "speed-reader-documents";
const PROGRESS_PREFIX = "speed-reader-progress:";

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
  hasEpubData?: boolean;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getProgress(
  id: string
): Partial<Pick<StoredDocument, "currentWordIndex" | "wpm" | "lastReadAt">> {
  try {
    const raw = localStorage.getItem(PROGRESS_PREFIX + id);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function mergeProgress(doc: StoredDocument): StoredDocument {
  const progress = getProgress(doc.id);
  if (!Object.keys(progress).length) return doc;
  return { ...doc, ...progress };
}

export function getAllDocuments(): StoredDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const docs = JSON.parse(raw) as StoredDocument[];
    return docs.map(mergeProgress);
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
  opts?: { hasPdfData?: boolean; hasEpubData?: boolean }
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
    ...(opts?.hasPdfData ? { hasPdfData: true } : {}),
    ...(opts?.hasEpubData ? { hasEpubData: true } : {}),
  };
  docs.unshift(doc);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  return doc;
}

export function updateDocument(
  id: string,
  updates: Partial<Pick<StoredDocument, "currentWordIndex" | "wpm" | "lastReadAt">>
): void {
  const progress = getProgress(id);
  const merged = { ...progress, ...updates, lastReadAt: Date.now() };
  localStorage.setItem(PROGRESS_PREFIX + id, JSON.stringify(merged));
}

export function deleteDocument(id: string): void {
  const doc = getDocument(id);
  const docs = getAllDocuments().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  localStorage.removeItem(PROGRESS_PREFIX + id);
  if (doc?.hasPdfData) {
    import("./pdf-store").then((m) => m.deletePdfData(id)).catch(() => {});
  }
  if (doc?.hasEpubData) {
    import("./epub-store").then((m) => m.deleteEpubData(id)).catch(() => {});
  }
}

export function getCompletionPercentage(doc: StoredDocument): number {
  if (doc.wordCount === 0) return 0;
  return Math.round((doc.currentWordIndex / doc.wordCount) * 100);
}
