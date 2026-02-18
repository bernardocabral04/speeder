import { useState, useCallback } from "react";
import {
  getAllDocuments,
  getDocument,
  saveDocument,
  updateDocument,
  deleteDocument,
  type StoredDocument,
} from "@/lib/storage";

export function useDocuments() {
  const [documents, setDocuments] = useState<StoredDocument[]>(getAllDocuments);

  const refresh = useCallback(() => {
    setDocuments(getAllDocuments());
  }, []);

  const add = useCallback(
    (filename: string, text: string, hasPdfData?: boolean) => {
      const doc = saveDocument(filename, text, hasPdfData);
      refresh();
      return doc;
    },
    [refresh]
  );

  const update = useCallback(
    (id: string, updates: Partial<Pick<StoredDocument, "currentWordIndex" | "wpm">>) => {
      updateDocument(id, updates);
    },
    []
  );

  const remove = useCallback(
    (id: string) => {
      deleteDocument(id);
      refresh();
    },
    [refresh]
  );

  const get = useCallback((id: string) => {
    return getDocument(id);
  }, []);

  return { documents, add, update, remove, get, refresh } as const;
}
