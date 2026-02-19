import { useState, useCallback, useRef } from "react";
import { RiUploadCloud2Line, RiFileTextLine } from "@remixicon/react";

const ACCEPTED_TYPES = new Set(["application/pdf", "text/plain", "application/epub+zip"]);
const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".epub"];

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
}

export function UploadZone({ onFileSelect, loading }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && isAcceptedFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
        e.target.value = "";
      }
    },
    [onFileSelect]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed p-12
        flex flex-col items-center justify-center gap-4
        transition-all duration-200
        ${
          dragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        }
        ${loading ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.txt,text/plain,.epub,application/epub+zip"
        onChange={handleChange}
        className="hidden"
      />

      {loading ? (
        <>
          <div className="size-12 rounded-full border-3 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Processing...</p>
        </>
      ) : (
        <>
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            {dragging ? (
              <RiFileTextLine className="size-8 text-primary" />
            ) : (
              <RiUploadCloud2Line className="size-8 text-primary" />
            )}
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">
              {dragging ? "Drop your file here" : "Upload a PDF, ePub, or text file"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Drag & drop or click to browse
            </p>
          </div>
        </>
      )}
    </div>
  );
}
