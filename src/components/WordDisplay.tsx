import { useMemo } from "react";
import { getORPIndex } from "@/lib/rsvp";

interface WordDisplayProps {
  word: string;
}

export function WordDisplay({ word }: WordDisplayProps) {
  const { before, orp, after } = useMemo(() => {
    if (!word) return { before: "", orp: "", after: "" };
    const idx = getORPIndex(word);
    return {
      before: word.slice(0, idx),
      orp: word[idx],
      after: word.slice(idx + 1),
    };
  }, [word]);

  if (!word) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-muted-foreground text-lg">
          Press play to start reading
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center h-full select-none overflow-hidden">
      {/* Vertical guide line at center */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/4 bottom-1/4 w-px bg-border" />

      {/* 3-column grid: before (right-aligned) | ORP (centered) | after (left-aligned) */}
      <div
        className="w-full font-mono text-5xl md:text-6xl lg:text-7xl tracking-wider"
        style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr" }}
      >
        <span className="text-right text-foreground whitespace-pre">{before}</span>
        <span className="text-primary font-bold">{orp}</span>
        <span className="text-left text-foreground whitespace-pre">{after}</span>
      </div>
    </div>
  );
}
