import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { StoredPdfData } from "@/lib/pdf-store";
import { PdfPage } from "./PdfPage";
import { FollowIndicator } from "./FollowIndicator";

interface PdfPaneProps {
  pdfDoc: PDFDocumentProxy;
  pdfData: StoredPdfData;
  currentWordIndex: number;
  currentWord: string;
  onWordClick: (index: number) => void;
}

interface PageDimension {
  width: number;
  height: number;
}

const PAGE_GAP = 12;

export function PdfPane({
  pdfDoc,
  pdfData,
  currentWordIndex,
  currentWord,
  onWordClick,
}: PdfPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageDimensions, setPageDimensions] = useState<PageDimension[]>([]);
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(true);
  const [indicatorDirection, setIndicatorDirection] = useState<"up" | "down">("down");

  // Measure container width with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch page dimensions on mount
  useEffect(() => {
    async function loadDimensions() {
      const dims: PageDimension[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        dims.push({ width: vp.width, height: vp.height });
      }
      setPageDimensions(dims);
      setReady(true);
    }
    loadDimensions();
  }, [pdfDoc]);

  // Determine current page from word index
  const currentPage = useMemo(() => {
    for (const range of pdfData.pageWordRanges) {
      if (currentWordIndex >= range.startWordIndex && currentWordIndex <= range.endWordIndex) {
        return range.pageIndex;
      }
    }
    return 0;
  }, [currentWordIndex, pdfData.pageWordRanges]);

  // Compute scale: fit widest page to container (with padding)
  const scale = useMemo(() => {
    if (!containerWidth || pageDimensions.length === 0) return 1;
    const padding = 32;
    const availableWidth = containerWidth - padding;
    const maxPageWidth = Math.max(...pageDimensions.map((d) => d.width));
    return availableWidth / maxPageWidth;
  }, [containerWidth, pageDimensions]);

  // Compute page offsets (cumulative Y positions)
  const pageOffsets = useMemo(() => {
    const offsets: number[] = [];
    let y = 0;
    for (const dim of pageDimensions) {
      offsets.push(y);
      y += dim.height * scale + PAGE_GAP;
    }
    return offsets;
  }, [pageDimensions, scale]);

  const totalHeight = useMemo(() => {
    if (pageDimensions.length === 0) return 0;
    const lastIdx = pageDimensions.length - 1;
    return pageOffsets[lastIdx] + pageDimensions[lastIdx].height * scale;
  }, [pageDimensions, pageOffsets, scale]);

  // Detect user scroll intent (wheel / touch) → break follow
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const breakFollow = () => setFollowing(false);

    container.addEventListener("wheel", breakFollow, { passive: true });
    container.addEventListener("touchstart", breakFollow, { passive: true });
    return () => {
      container.removeEventListener("wheel", breakFollow);
      container.removeEventListener("touchstart", breakFollow);
    };
  }, [ready]);

  // Update indicator direction as user scrolls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDirection = () => {
      const targetY = pageOffsets[currentPage] ?? 0;
      setIndicatorDirection(targetY < container.scrollTop ? "up" : "down");
    };

    container.addEventListener("scroll", updateDirection, { passive: true });
    return () => container.removeEventListener("scroll", updateDirection);
  }, [ready, currentPage, pageOffsets]);

  // Auto-scroll when page changes (only when following)
  useEffect(() => {
    if (!ready || !following) return;

    const container = containerRef.current;
    if (!container || pageOffsets[currentPage] == null) return;

    const targetY = pageOffsets[currentPage];
    container.scrollTo({ top: targetY, behavior: "smooth" });
  }, [currentPage, ready, pageOffsets, following]);

  // Determine visible pages: currentPage ± 1
  const visiblePages = useMemo(() => {
    const pages: number[] = [];
    for (
      let i = Math.max(0, currentPage - 1);
      i <= Math.min(pdfDoc.numPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, pdfDoc.numPages]);

  // Get word range for a page
  const getPageWordRange = useCallback(
    (pageIdx: number) => {
      const range = pdfData.pageWordRanges[pageIdx];
      if (!range) return { start: 0, end: 0 };
      return { start: range.startWordIndex, end: range.endWordIndex };
    },
    [pdfData.pageWordRanges]
  );

  const handleFollow = useCallback(() => {
    setFollowing(true);
  }, []);

  const handleWordClick = useCallback(
    (index: number) => {
      setFollowing(true);
      onWordClick(index);
    },
    [onWordClick]
  );

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading PDF...
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <div ref={containerRef} className="h-full overflow-y-auto scrollbar-thin">
        <div className="relative" style={{ height: totalHeight }}>
          {pageDimensions.map((dim, pageIdx) => {
            const isVisible = visiblePages.includes(pageIdx);
            const pageHeight = dim.height * scale;
            const pageWidth = dim.width * scale;
            const top = pageOffsets[pageIdx];

            if (!isVisible) {
              return (
                <div
                  key={pageIdx}
                  className="absolute left-1/2 -translate-x-1/2 bg-muted/30 border border-border rounded flex items-center justify-center"
                  style={{
                    top,
                    width: pageWidth,
                    height: pageHeight,
                  }}
                >
                  <span className="text-muted-foreground text-sm">
                    Page {pageIdx + 1}
                  </span>
                </div>
              );
            }

            const { start, end } = getPageWordRange(pageIdx);

            return (
              <div
                key={pageIdx}
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top }}
              >
                <PdfPage
                  pdfDoc={pdfDoc}
                  pageIndex={pageIdx}
                  scale={scale}
                  words={pdfData.words}
                  currentWordIndex={currentWordIndex}
                  pageStartWord={start}
                  pageEndWord={end}
                  onWordClick={handleWordClick}
                />
              </div>
            );
          })}
        </div>
      </div>

      {!following && (
        <FollowIndicator
          currentWord={currentWord}
          direction={indicatorDirection}
          onFollow={handleFollow}
        />
      )}
    </div>
  );
}
