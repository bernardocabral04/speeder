import { useState, useCallback } from "react";
import {
  getAllFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveDocumentToFolder,
  type Folder,
} from "@/lib/storage";

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>(getAllFolders);

  const refresh = useCallback(() => {
    setFolders(getAllFolders());
  }, []);

  const add = useCallback(
    (name: string) => {
      const folder = createFolder(name);
      refresh();
      return folder;
    },
    [refresh]
  );

  const rename = useCallback(
    (id: string, name: string) => {
      renameFolder(id, name);
      refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    (id: string) => {
      deleteFolder(id);
      refresh();
    },
    [refresh]
  );

  const moveDocument = useCallback(
    (docId: string, folderId: string | null) => {
      moveDocumentToFolder(docId, folderId);
    },
    []
  );

  return { folders, add, rename, remove, moveDocument, refresh } as const;
}
