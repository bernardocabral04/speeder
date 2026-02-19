import { RiFilePdf2Line, RiFileTextLine, RiBookLine, RiDeleteBinLine, RiTimeLine } from "@remixicon/react";
import { getCompletionPercentage, type StoredDocument } from "@/lib/storage";
import { Button } from "@/components/ui/button";

interface DocumentCardProps {
  doc: StoredDocument;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DocumentCard({ doc, onOpen, onDelete }: DocumentCardProps) {
  const completion = getCompletionPercentage(doc);

  return (
    <div
      onClick={() => onOpen(doc.id)}
      className="group relative rounded-xl ring-1 ring-border bg-card p-4 cursor-pointer hover:ring-primary/40 hover:bg-muted/30 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {doc.hasPdfData ? (
            <RiFilePdf2Line className="size-5 text-primary" />
          ) : doc.filename.toLowerCase().endsWith(".epub") ? (
            <RiBookLine className="size-5 text-primary" />
          ) : (
            <RiFileTextLine className="size-5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate text-foreground max-w-xs">
            {doc.filename}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{doc.wordCount.toLocaleString()} words</span>
            <span>{doc.wpm} WPM</span>
            <span className="flex items-center gap-1">
              <RiTimeLine className="size-3" />
              {formatTimeAgo(doc.lastReadAt)}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(doc.id);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        >
          <RiDeleteBinLine className="size-3.5" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${completion}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground font-medium tabular-nums w-8 text-right">
          {completion}%
        </span>
      </div>
    </div>
  );
}
