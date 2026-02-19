import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { FollowIndicator } from "./FollowIndicator";

interface TextPaneProps {
  words: string[];
  currentIndex: number;
  onWordClick: (index: number) => void;
  fontScale?: number;
}

const WINDOW_SIZE = 500;

export function TextPane({ words, currentIndex, onWordClick, fontScale = 100 }: TextPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);
  const [following, setFollowing] = useState(true);
  const [indicatorDirection, setIndicatorDirection] = useState<"up" | "down">("down");
  const hasScrolledOnce = useRef(false);

  // Virtualized window: show 500 words before and after current position
  const { windowStart, windowEnd } = useMemo(() => {
    const start = Math.max(0, currentIndex - WINDOW_SIZE);
    const end = Math.min(words.length, currentIndex + WINDOW_SIZE);
    return { windowStart: start, windowEnd: end };
  }, [currentIndex, words.length]);

  const visibleWords = useMemo(
    () => words.slice(windowStart, windowEnd),
    [words, windowStart, windowEnd]
  );

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
  }, []);

  // Update indicator direction as user scrolls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDirection = () => {
      const active = activeRef.current;
      if (!active) return;
      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      setIndicatorDirection(activeRect.top < containerRect.top ? "up" : "down");
    };

    container.addEventListener("scroll", updateDirection, { passive: true });
    return () => container.removeEventListener("scroll", updateDirection);
  }, []);

  // Auto-scroll to keep active word visible (only when following)
  useEffect(() => {
    if (!following || !activeRef.current) return;

    activeRef.current.scrollIntoView({
      behavior: hasScrolledOnce.current ? "smooth" : "instant",
      block: "center",
    });
    hasScrolledOnce.current = true;
  }, [currentIndex, following]);

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

  return (
    <div className="h-full relative">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto p-6 leading-relaxed scrollbar-thin"
        style={{ fontSize: `${fontScale / 100}rem` }}
      >
        {windowStart > 0 && (
          <div className="text-muted-foreground text-sm mb-3 text-center">
            ... {windowStart} words above ...
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">
          {visibleWords.map((word, i) => {
            const globalIndex = windowStart + i;
            const isActive = globalIndex === currentIndex;
            return (
              <span key={globalIndex}>
                <span
                  ref={isActive ? activeRef : undefined}
                  onClick={() => handleWordClick(globalIndex)}
                  className={
                    isActive
                      ? "bg-primary/20 text-primary rounded px-0.5 cursor-pointer transition-colors [text-shadow:0.3px_0_0_currentColor,-0.3px_0_0_currentColor]"
                      : globalIndex < currentIndex
                        ? "text-muted-foreground/60 cursor-pointer hover:text-foreground transition-colors"
                        : "text-foreground cursor-pointer hover:text-primary/70 transition-colors"
                  }
                >
                  {word}
                </span>{" "}
              </span>
            );
          })}
        </p>
        {windowEnd < words.length && (
          <div className="text-muted-foreground text-sm mt-3 text-center">
            ... {words.length - windowEnd} words below ...
          </div>
        )}
      </div>

      {!following && (
        <FollowIndicator
          currentWord={words[currentIndex] ?? ""}
          direction={indicatorDirection}
          onFollow={handleFollow}
        />
      )}
    </div>
  );
}
