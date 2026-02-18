import { useState, useEffect } from "react";
import { getDocument as getPdfDocument } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "../lib/pdf"; // ensure worker is configured
import { getPdfData, type StoredPdfData } from "@/lib/pdf-store";

interface UsePdfDocumentResult {
  pdfDoc: PDFDocumentProxy | null;
  pdfData: StoredPdfData | null;
  loading: boolean;
  error: string | null;
}

export function usePdfDocument(documentId: string | null): UsePdfDocumentResult {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfData, setPdfData] = useState<StoredPdfData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPdfData(documentId!);
        if (cancelled) return;
        if (!data) {
          setError("PDF data not found in storage");
          return;
        }
        setPdfData(data);

        const pdfDocument = await getPdfDocument({
          data: data.pdfBytes.slice(0),
        }).promise;
        if (cancelled) {
          pdfDocument.destroy();
          return;
        }
        doc = pdfDocument;
        setPdfDoc(pdfDocument);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load PDF");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      doc?.destroy();
    };
  }, [documentId]);

  return { pdfDoc, pdfData, loading, error };
}
