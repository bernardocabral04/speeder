import { useState, useRef, useEffect, useCallback } from "react";
import {
  RiFolderLine,
  RiFolderOpenLine,
  RiMore2Line,
  RiPencilLine,
  RiDeleteBinLine,
} from "@remixicon/react";
import { type Folder } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface FolderCardProps {
  folder: Folder;
  documentCount: number;
  initialRenaming?: boolean;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDropDocument: (folderId: string, docId: string) => void;
}

export function FolderCard({
  folder,
  documentCount,
  initialRenaming = false,
  onOpen,
  onRename,
  onDelete,
  onDropDocument,
}: FolderCardProps) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [renaming, setRenaming] = useState(initialRenaming);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialRenaming) setRenaming(true);
  }, [initialRenaming]);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const commitRename = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed && trimmed !== folder.name) {
        onRename(folder.id, trimmed);
      }
      setRenaming(false);
    },
    [folder.id, folder.name, onRename]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("application/x-document-id")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDropTarget(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDropTarget(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDropTarget(false);
      const docId = e.dataTransfer.getData("application/x-document-id");
      if (docId) {
        onDropDocument(folder.id, docId);
      }
    },
    [folder.id, onDropDocument]
  );

  return (
    <div
      onClick={() => !renaming && onOpen(folder.id)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        group relative rounded-xl ring-1 bg-card p-4 cursor-pointer
        transition-all duration-200
        ${
          isDropTarget
            ? "ring-primary bg-primary/5 scale-[1.02]"
            : "ring-border hover:ring-primary/40 hover:bg-muted/30"
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          {isDropTarget ? (
            <RiFolderOpenLine className="size-5 text-primary" />
          ) : (
            <RiFolderLine className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {renaming ? (
            <Input
              ref={inputRef}
              autoFocus
              defaultValue={folder.name}
              className="h-7 text-sm font-medium rounded-lg"
              onBlur={(e) => commitRename(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(e.currentTarget.value);
                if (e.key === "Escape") setRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="font-medium text-sm truncate text-foreground">
              {folder.name}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {documentCount} {documentCount === 1 ? "document" : "documents"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <RiMore2Line className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setRenaming(true);
              }}
            >
              <RiPencilLine className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(folder.id);
              }}
              className="text-destructive focus:text-destructive"
            >
              <RiDeleteBinLine className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
