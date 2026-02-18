import { RiArrowDownLine } from "@remixicon/react";

interface FollowIndicatorProps {
  currentWord: string;
  direction: "up" | "down";
  onFollow: () => void;
}

export function FollowIndicator({
  currentWord,
  direction,
  onFollow,
}: FollowIndicatorProps) {
  return (
    <button
      onClick={onFollow}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg backdrop-blur-sm cursor-pointer hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <span className="text-sm font-medium max-w-32 truncate">
        {currentWord}
      </span>
      <RiArrowDownLine
        className={`size-4 shrink-0 ${direction === "up" ? "rotate-180" : ""}`}
      />
    </button>
  );
}
