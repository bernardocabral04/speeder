import { useState, useCallback, useEffect, useSyncExternalStore } from "react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { getDocument, type StoredDocument } from "@/lib/storage";
import { HomePage } from "@/components/HomePage";
import { ReaderPage } from "@/components/ReaderPage";

function getHash() {
  return window.location.hash;
}

function useHash() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    getHash
  );
}

function parseDocId(hash: string): string | null {
  const match = hash.match(/^#\/read\/(.+)$/);
  return match ? match[1] : null;
}

export function App() {
  const { dark, toggle: toggleDark } = useDarkMode();
  const hash = useHash();
  const docId = parseDocId(hash);
  const [activeDoc, setActiveDoc] = useState<StoredDocument | null>(() => {
    if (docId) return getDocument(docId);
    return null;
  });

  // Sync activeDoc when hash changes
  useEffect(() => {
    if (docId) {
      const doc = getDocument(docId);
      if (doc) {
        setActiveDoc(doc);
      } else {
        // Document not found — go home
        window.location.hash = "";
        setActiveDoc(null);
      }
    } else {
      setActiveDoc(null);
    }
  }, [docId]);

  const openDocument = useCallback((id: string) => {
    const doc = getDocument(id);
    if (!doc) return;
    setActiveDoc(doc);
    window.location.hash = `/read/${id}`;
  }, []);

  const goHome = useCallback(() => {
    setActiveDoc(null);
    window.location.hash = "";
  }, []);

  if (docId && activeDoc) {
    return (
      <ReaderPage
        key={activeDoc.id}
        document={activeDoc}
        onBack={goHome}
        dark={dark}
        onToggleDark={toggleDark}
      />
    );
  }

  return (
    <HomePage
      onOpenDocument={openDocument}
      dark={dark}
      onToggleDark={toggleDark}
    />
  );
}

export default App;
