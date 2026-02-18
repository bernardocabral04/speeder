import {
  RiArrowLeftLine,
  RiMoonLine,
  RiSunLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";

interface ReaderHeaderProps {
  filename: string;
  progressPercent: number;
  dark: boolean;
  onBack: () => void;
  onToggleDark: () => void;
}

export function ReaderHeader({ filename, progressPercent, dark, onBack, onToggleDark }: ReaderHeaderProps) {
  return (
    <header className="border-b border-border shrink-0">
      <div className="px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={onBack}>
            <RiArrowLeftLine className="size-4" />
          </Button>
          <span className="text-sm font-medium text-foreground truncate max-w-[300px]">
            {filename}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground tabular-nums mr-2">
            {progressPercent}% complete
          </span>
          <Button variant="ghost" size="icon-sm" onClick={onToggleDark}>
            {dark ? (
              <RiSunLine className="size-4" />
            ) : (
              <RiMoonLine className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
