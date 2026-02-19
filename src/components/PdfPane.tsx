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
  zoomLevel?: number;
}

interface PageDimension {
  width: number;
  height: number;
}

const PAGE_GAP = 12;

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function PdfPane({
  pdfDoc,
  pdfData,
  currentWordIndex,
  currentWord,
  onWordClick,
  zoomLevel = 100,
}: PdfPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageDimensions, setPageDimensions] = useState<PageDimension[]>([]);
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(true);
  const [indicatorDirection, setIndicatorDirection] = useState<"up" | "down">("down");
  const hasScrolledOnce = useRef(false);
  const resizedRef = useRef(false);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const visiblePagesRef = useRef(visiblePages);
  visiblePagesRef.current = visiblePages;

  // Measure container width with ResizeObserver (debounced)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (containerRef.current) {
          resizedRef.current = true;
          setContainerWidth(containerRef.current.clientWidth);
        }
      }, 150);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ready]);

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
    return (availableWidth / maxPageWidth) * (zoomLevel / 100);
  }, [containerWidth, pageDimensions, zoomLevel]);

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

  // Refs mirroring layout memos so scroll handler can read them without deps
  const pageOffsetsRef = useRef(pageOffsets);
  pageOffsetsRef.current = pageOffsets;
  const pageDimensionsRef = useRef(pageDimensions);
  pageDimensionsRef.current = pageDimensions;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

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

  // Consolidated scroll handler: updates indicator direction + visible pages
  // Uses refs so the handler is stable and doesn't cause re-renders on every frame.
  // Only triggers a React re-render when the visible page set actually changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const computeVisiblePages = (st: number, vh: number): Set<number> => {
      const offsets = pageOffsetsRef.current;
      const dims = pageDimensionsRef.current;
      const s = scaleRef.current;
      if (dims.length === 0 || !vh) return new Set();

      const pages = new Set<number>();
      const bufferTop = st - vh;
      const bufferBottom = st + vh * 2;

      for (let i = 0; i < dims.length; i++) {
        const top = offsets[i];
        const bottom = top + dims[i].height * s;
        if (bottom >= bufferTop && top <= bufferBottom) {
          pages.add(i);
        }
      }
      return pages;
    };

    const onScroll = () => {
      const st = container.scrollTop;
      const vh = container.clientHeight;

      // Update indicator direction
      const targetY = pageOffsetsRef.current[currentPageRef.current] ?? 0;
      setIndicatorDirection(targetY < st ? "up" : "down");

      // Compute visible pages and only setState if changed
      const next = computeVisiblePages(st, vh);
      if (!setsEqual(next, visiblePagesRef.current)) {
        setVisiblePages(next);
      }
    };

    // Initial computation
    onScroll();

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [ready]);

  // Recompute visible pages when layout changes (scale, dimensions, resize)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const st = container.scrollTop;
    const vh = container.clientHeight;
    if (!vh) return;

    const offsets = pageOffsets;
    const dims = pageDimensions;
    if (dims.length === 0) return;

    const pages = new Set<number>();
    const bufferTop = st - vh;
    const bufferBottom = st + vh * 2;

    for (let i = 0; i < dims.length; i++) {
      const top = offsets[i];
      const bottom = top + dims[i].height * scale;
      if (bottom >= bufferTop && top <= bufferBottom) {
        pages.add(i);
      }
    }
    if (!setsEqual(pages, visiblePagesRef.current)) {
      setVisiblePages(pages);
    }
  }, [pageOffsets, pageDimensions, scale]);

  // Auto-scroll to keep current word visible (only when following)
  useEffect(() => {
    if (!ready || !following || !containerWidth) return;

    const container = containerRef.current;
    if (!container || pageOffsets[currentPage] == null) return;

    const word = pdfData.words[currentWordIndex];
    if (!word) return;

    // Convert PDF coords (origin bottom-left) to viewport Y (origin top-left)
    const pageDim = pageDimensions[word.pageIndex];
    if (!pageDim) return;

    const wordViewportY = (pageDim.height - word.pdfRect.y) * scale;
    const wordAbsoluteY = pageOffsets[word.pageIndex] + wordViewportY;

    // Center the word in the visible area
    const targetY = wordAbsoluteY - container.clientHeight / 2;
    const behavior = !hasScrolledOnce.current || resizedRef.current ? "instant" : "smooth";
    resizedRef.current = false;
    container.scrollTo({ top: targetY, behavior });
    hasScrolledOnce.current = true;
  }, [currentWordIndex, ready, following, pageOffsets, currentPage, pdfData.words, pageDimensions, scale, containerWidth]);

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
            const isVisible = visiblePages.has(pageIdx);
            const pageHeight = dim.height * scale;
            const pageWidth = dim.width * scale;
            const top = pageOffsets[pageIdx];
            const left = (containerWidth - pageWidth) / 2;

            if (!isVisible) {
              return (
                <div
                  key={pageIdx}
                  className="absolute bg-muted/30 border border-border rounded flex items-center justify-center"
                  style={{
                    top,
                    left,
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
                className="absolute"
                style={{ top, left }}
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
