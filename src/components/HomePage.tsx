import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiMoonLine,
  RiSunLine,
  RiSpeedLine,
  RiFolderAddLine,
  RiArrowRightSLine,
} from "@remixicon/react";
import { extractPdfWithPositions } from "@/lib/pdf-extraction";
import { savePdfData } from "@/lib/pdf-store";
import { useDocuments } from "@/hooks/useDocuments";
import { useFolders } from "@/hooks/useFolders";
import { UploadZone } from "./UploadZone";
import { DocumentCard } from "./DocumentCard";
import { FolderCard } from "./FolderCard";
import { Button } from "@/components/ui/button";

interface HomePageProps {
  onOpenDocument: (id: string) => void;
  dark: boolean;
  onToggleDark: () => void;
}

const itemAnimation = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2 },
};

export function HomePage({ onOpenDocument, dark, onToggleDark }: HomePageProps) {
  const { documents, add, remove, refresh: refreshDocs } = useDocuments();
  const {
    folders,
    add: addFolder,
    rename: renameFolder,
    remove: removeFolder,
    moveDocument,
    refresh: refreshFolders,
  } = useFolders();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [breadcrumbDropTarget, setBreadcrumbDropTarget] = useState(false);

  const currentFolder = useMemo(
    () =>
      currentFolderId
        ? folders.find((f) => f.id === currentFolderId) ?? null
        : null,
    [currentFolderId, folders]
  );

  const visibleDocuments = useMemo(
    () =>
      documents.filter((d) =>
        currentFolderId === null ? !d.folderId : d.folderId === currentFolderId
      ),
    [documents, currentFolderId]
  );

  const folderDocCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of documents) {
      if (doc.folderId) {
        counts.set(doc.folderId, (counts.get(doc.folderId) ?? 0) + 1);
      }
    }
    return counts;
  }, [documents]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const name = file.name.toLowerCase();
        const isPdf =
          file.type === "application/pdf" || name.endsWith(".pdf");
        const isEpub =
          file.type === "application/epub+zip" || name.endsWith(".epub");

        const folderOpt = currentFolderId
          ? { folderId: currentFolderId }
          : {};

        let text: string;

        if (isPdf) {
          const pdfBytes = await file.arrayBuffer();
          const result = await extractPdfWithPositions(pdfBytes);
          if (!result.text.trim()) {
            setError("Could not extract text from this PDF.");
            return;
          }
          const doc = add(file.name, result.text, {
            hasPdfData: true,
            ...folderOpt,
          });
          await savePdfData({
            documentId: doc.id,
            pdfBytes,
            words: result.words,
            pageWordRanges: result.pageWordRanges,
            numPages: result.numPages,
          });
          onOpenDocument(doc.id);
          return;
        } else if (isEpub) {
          const { extractEpub } = await import("@/lib/epub-extraction");
          const { saveEpubData } = await import("@/lib/epub-store");
          const result = await extractEpub(await file.arrayBuffer());
          if (!result.text.trim()) {
            setError("Could not extract text from this ePub.");
            return;
          }
          const doc = add(file.name, result.text, {
            hasEpubData: true,
            ...folderOpt,
          });
          await saveEpubData({
            documentId: doc.id,
            chapters: result.chapters,
            images: result.images,
          });
          onOpenDocument(doc.id);
          return;
        } else {
          text = await file.text();
        }

        if (!text.trim()) {
          setError("Could not extract text from this file.");
          return;
        }
        const doc = add(file.name, text, folderOpt);
        onOpenDocument(doc.id);
      } catch {
        setError("Failed to process file. Please try another.");
      } finally {
        setLoading(false);
      }
    },
    [add, onOpenDocument, currentFolderId]
  );

  const handleCreateFolder = useCallback(() => {
    const folder = addFolder("Untitled Folder");
    setRenamingFolderId(folder.id);
  }, [addFolder]);

  const handleDeleteFolder = useCallback(
    (id: string) => {
      removeFolder(id);
      refreshDocs();
    },
    [removeFolder, refreshDocs]
  );

  const handleDropOnFolder = useCallback(
    (folderId: string, docId: string) => {
      moveDocument(docId, folderId);
      refreshDocs();
      refreshFolders();
    },
    [moveDocument, refreshDocs, refreshFolders]
  );

  const handleDropOnRoot = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setBreadcrumbDropTarget(false);
      const docId = e.dataTransfer.getData("application/x-document-id");
      if (docId) {
        moveDocument(docId, null);
        refreshDocs();
      }
    },
    [moveDocument, refreshDocs]
  );

  const handleRenameFolder = useCallback(
    (id: string, name: string) => {
      renameFolder(id, name);
      setRenamingFolderId(null);
    },
    [renameFolder]
  );

  const isAtRoot = currentFolderId === null;
  const hasContent =
    visibleDocuments.length > 0 || (isAtRoot && folders.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RiSpeedLine className="size-5 text-primary" />
            <h1 className="font-semibold text-foreground">Speeder</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={onToggleDark}>
            {dark ? (
              <RiSunLine className="size-4" />
            ) : (
              <RiMoonLine className="size-4" />
            )}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground">
            Speed Reader
          </h2>
          <p className="text-muted-foreground mt-1">
            Upload a document and read it faster with RSVP technique
          </p>
        </div>

        {/* Breadcrumb */}
        {!isAtRoot && currentFolder && (
          <div className="mb-6 flex items-center gap-1 text-sm">
            <button
              onClick={() => setCurrentFolderId(null)}
              onDragOver={(e) => {
                if (
                  !e.dataTransfer.types.includes("application/x-document-id")
                )
                  return;
                e.preventDefault();
                setBreadcrumbDropTarget(true);
              }}
              onDragLeave={() => setBreadcrumbDropTarget(false)}
              onDrop={handleDropOnRoot}
              className={`font-medium transition-colors cursor-pointer ${
                breadcrumbDropTarget
                  ? "text-primary underline"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Documents
            </button>
            <RiArrowRightSLine className="size-4 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {currentFolder.name}
            </span>
          </div>
        )}

        <UploadZone onFileSelect={handleFileSelect} loading={loading} />

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-sm text-destructive text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {hasContent && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {isAtRoot ? "Library" : currentFolder?.name}
              </h3>
              {isAtRoot && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCreateFolder}
                  className="text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <RiFolderAddLine className="size-4" />
                  New Folder
                </Button>
              )}
            </div>

            {/* Folders (root only) */}
            {isAtRoot && folders.length > 0 && (
              <div className="grid gap-3 mb-3">
                <AnimatePresence mode="popLayout">
                  {folders.map((folder) => (
                    <motion.div key={folder.id} layout {...itemAnimation}>
                      <FolderCard
                        folder={folder}
                        documentCount={folderDocCounts.get(folder.id) ?? 0}
                        initialRenaming={renamingFolderId === folder.id}
                        onOpen={setCurrentFolderId}
                        onRename={handleRenameFolder}
                        onDelete={handleDeleteFolder}
                        onDropDocument={handleDropOnFolder}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Documents */}
            <div className="grid gap-3">
              <AnimatePresence mode="popLayout">
                {visibleDocuments.map((doc) => (
                  <motion.div key={doc.id} layout {...itemAnimation}>
                    <DocumentCard
                      doc={doc}
                      onOpen={onOpenDocument}
                      onDelete={remove}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Empty folder state */}
            {!isAtRoot && visibleDocuments.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">
                This folder is empty. Upload a file or drag documents here.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
