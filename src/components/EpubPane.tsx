import { memo, useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { StoredEpubData } from "@/lib/epub-store";
import { FollowIndicator } from "./FollowIndicator";
import "./epub-pane.css";

interface EpubPaneProps {
  epubData: StoredEpubData;
  imageUrls: Map<string, string>;
  currentWordIndex: number;
  currentWord: string;
  onWordClick: (index: number) => void;
  zoomLevel?: number;
}

// Memoized chapter renderer — only re-renders when html actually changes
const EpubChapterDiv = memo(function EpubChapterDiv({
  html,
}: {
  html: string;
}) {
  return (
    <div
      className="epub-chapter"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

// How many chapters before/after the current one to render
const CHAPTER_WINDOW = 2;

export function EpubPane({
  epubData,
  imageUrls,
  currentWordIndex,
  currentWord,
  onWordClick,
  zoomLevel = 100,
}: EpubPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const [indicatorDirection, setIndicatorDirection] = useState<"up" | "down">(
    "down"
  );
  const hasScrolledOnce = useRef(false);
  const prevHighlightRef = useRef<Element | null>(null);

  // Determine which chapter the current word is in
  const currentChapterIdx = useMemo(() => {
    for (let i = 0; i < epubData.chapters.length; i++) {
      const ch = epubData.chapters[i];
      if (
        currentWordIndex >= ch.startWordIndex &&
        currentWordIndex <= ch.endWordIndex
      ) {
        return i;
      }
    }
    return 0;
  }, [currentWordIndex, epubData.chapters]);

  // Replace epub-image:// placeholders with blob URLs in chapter HTML
  const processedChapters = useMemo(() => {
    return epubData.chapters.map((ch) => {
      let html = ch.html;
      for (const [path, url] of imageUrls) {
        html = html.replaceAll(`epub-image://${path}`, url);
      }
      return { ...ch, html };
    });
  }, [epubData.chapters, imageUrls]);

  // Which chapters to render (current ± CHAPTER_WINDOW)
  const visibleRange = useMemo(() => {
    const start = Math.max(0, currentChapterIdx - CHAPTER_WINDOW);
    const end = Math.min(
      processedChapters.length - 1,
      currentChapterIdx + CHAPTER_WINDOW
    );
    return { start, end };
  }, [currentChapterIdx, processedChapters.length]);

  // Detect user scroll → break follow
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
  }, []);

  // Update indicator direction on scroll (uses refs, stable handler)
  const currentWordRef = useRef(currentWordIndex);
  currentWordRef.current = currentWordIndex;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDirection = () => {
      const el = container.querySelector(
        `[data-chapter="${currentWordRef.current}"]`
      );
      if (!el) {
        // Fall back to finding the active word directly
        const wordEl = prevHighlightRef.current;
        if (!wordEl) return;
        const containerRect = container.getBoundingClientRect();
        const activeRect = wordEl.getBoundingClientRect();
        setIndicatorDirection(
          activeRect.top < containerRect.top ? "up" : "down"
        );
        return;
      }
    };

    container.addEventListener("scroll", updateDirection, { passive: true });
    return () => container.removeEventListener("scroll", updateDirection);
  }, []);

  // Highlight current word and auto-scroll — scoped to current chapter wrapper
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove previous highlight
    if (prevHighlightRef.current) {
      prevHighlightRef.current.classList.remove("epub-word-active");
      prevHighlightRef.current = null;
    }

    // Scope search to current chapter wrapper via data attribute
    const chapterEl = container.querySelector(
      `[data-chapter="${currentChapterIdx}"]`
    );
    if (!chapterEl) return;

    const el = chapterEl.querySelector(
      `[data-word-index="${currentWordIndex}"]`
    );
    if (el) {
      el.classList.add("epub-word-active");
      prevHighlightRef.current = el;

      if (following) {
        el.scrollIntoView({
          behavior: hasScrolledOnce.current ? "smooth" : "instant",
          block: "center",
        });
        hasScrolledOnce.current = true;
      }
    }
  }, [currentWordIndex, following, currentChapterIdx]);

  // Click handler: delegate to word spans
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-word-index]");
      if (!target) return;
      const idx = parseInt(target.getAttribute("data-word-index") ?? "", 10);
      if (!isNaN(idx)) {
        setFollowing(true);
        onWordClick(idx);
      }
    },
    [onWordClick]
  );

  const handleFollow = useCallback(() => {
    setFollowing(true);
  }, []);

  const fontSize = `${zoomLevel / 100}rem`;

  return (
    <div className="h-full relative">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-thin"
        onClick={handleClick}
        style={{ fontSize }}
      >
        <div className="max-w-2xl mx-auto px-6 py-8 epub-content">
          {processedChapters.map((ch, i) => {
            if (i < visibleRange.start || i > visibleRange.end) {
              return (
                <div key={i} className="epub-chapter text-muted-foreground text-center py-4 text-sm">
                  Chapter {i + 1}
                </div>
              );
            }
            return (
              <div key={i} data-chapter={i}>
                <EpubChapterDiv html={ch.html} />
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
