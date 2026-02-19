import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RiMoonLine, RiSunLine, RiSpeedLine } from "@remixicon/react";
import { extractPdfWithPositions } from "@/lib/pdf-extraction";
import { savePdfData } from "@/lib/pdf-store";
import { useDocuments } from "@/hooks/useDocuments";
import { UploadZone } from "./UploadZone";
import { DocumentCard } from "./DocumentCard";
import { Button } from "@/components/ui/button";

interface HomePageProps {
  onOpenDocument: (id: string) => void;
  dark: boolean;
  onToggleDark: () => void;
}

export function HomePage({ onOpenDocument, dark, onToggleDark }: HomePageProps) {
  const { documents, add, remove } = useDocuments();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        let text: string;

        if (isPdf) {
          const pdfBytes = await file.arrayBuffer();
          const result = await extractPdfWithPositions(pdfBytes);
          if (!result.text.trim()) {
            setError("Could not extract text from this PDF.");
            return;
          }
          const doc = add(file.name, result.text, { hasPdfData: true });
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
          const doc = add(file.name, result.text, { hasEpubData: true });
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
        const doc = add(file.name, text);
        onOpenDocument(doc.id);
      } catch {
        setError("Failed to process file. Please try another.");
      } finally {
        setLoading(false);
      }
    },
    [add, onOpenDocument]
  );

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
          <h2 className="text-2xl font-semibold text-foreground">Speed Reader</h2>
          <p className="text-muted-foreground mt-1">
            Upload a document and read it faster with RSVP technique
          </p>
        </div>

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

        {documents.length > 0 && (
          <div className="mt-10">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Recent Documents
            </h3>
            <div className="grid gap-3">
              <AnimatePresence mode="popLayout">
                {documents.map((doc) => (
                  <motion.div
                    key={doc.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <DocumentCard
                      doc={doc}
                      onOpen={onOpenDocument}
                      onDelete={remove}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
