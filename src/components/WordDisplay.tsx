import { useMemo, useRef, useState, useEffect } from "react";
import { getORPIndex } from "@/lib/rsvp";

interface WordDisplayProps {
  word: string;
  fontScale?: number;
}

export function WordDisplay({ word, fontScale = 100 }: WordDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

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

  const { before, orp, after } = useMemo(() => {
    if (!word) return { before: "", orp: "", after: "" };
    const idx = getORPIndex(word);
    return {
      before: word.slice(0, idx),
      orp: word[idx],
      after: word.slice(idx + 1),
    };
  }, [word]);

  // Compute font size from container width instead of vw
  const fontSize = useMemo(() => {
    if (!containerWidth) return "3rem";
    const scale = fontScale / 100;
    const sizePx = containerWidth * 0.06 * scale;
    const clamped = Math.max(24, Math.min(sizePx, 72 * scale));
    return `${clamped}px`;
  }, [containerWidth, fontScale]);

  if (!word) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-full">
        <span className="text-muted-foreground text-lg">
          Press play to start reading
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex items-center justify-center h-full select-none overflow-hidden">
      {/* Vertical guide line at center */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/4 bottom-1/4 w-px bg-border" />

      {/* 3-column grid: before (right-aligned) | ORP (centered) | after (left-aligned) */}
      <div
        className="w-full font-mono tracking-wider"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          fontSize,
        }}
      >
        <span className="text-right text-foreground whitespace-pre">{before}</span>
        <span className="text-primary font-bold">{orp}</span>
        <span className="text-left text-foreground whitespace-pre">{after}</span>
      </div>
    </div>
  );
}
