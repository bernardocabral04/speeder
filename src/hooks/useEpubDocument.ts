import { useState, useEffect, useRef } from "react";
import { getEpubData, type StoredEpubData } from "@/lib/epub-store";

interface UseEpubDocumentResult {
  epubData: StoredEpubData | null;
  imageUrls: Map<string, string>;
  loading: boolean;
  error: string | null;
}

export function useEpubDocument(
  documentId: string | null
): UseEpubDocumentResult {
  const [epubData, setEpubData] = useState<StoredEpubData | null>(null);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!documentId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getEpubData(documentId!);
        if (cancelled) return;
        if (!data) {
          setError("ePub data not found in storage");
          return;
        }
        setEpubData(data);

        // Create blob URLs for images
        const urls = new Map<string, string>();
        const blobs: string[] = [];
        for (const img of data.images) {
          const blob = new Blob([img.data]);
          const url = URL.createObjectURL(blob);
          urls.set(img.path, url);
          blobs.push(url);
        }
        blobUrlsRef.current = blobs;
        setImageUrls(urls);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load ePub"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      blobUrlsRef.current = [];
    };
  }, [documentId]);

  return { epubData, imageUrls, loading, error };
}
