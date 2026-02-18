import { useRef, useEffect, useCallback } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { PdfWord } from "@/lib/pdf-store";

interface PdfPageProps {
  pdfDoc: PDFDocumentProxy;
  pageIndex: number;
  scale: number;
  words: PdfWord[];
  currentWordIndex: number;
  pageStartWord: number;
  pageEndWord: number;
  onWordClick: (wordIndex: number) => void;
}

export function PdfPage({
  pdfDoc,
  pageIndex,
  scale,
  words,
  currentWordIndex,
  pageStartWord,
  pageEndWord,
  onWordClick,
}: PdfPageProps) {
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const viewportRef = useRef<{ width: number; height: number; offsetX: number; offsetY: number } | null>(null);
  const renderTaskRef = useRef<ReturnType<PDFPageProxy["render"]> | null>(null);

  // Render the PDF page on the page canvas (only when page/scale changes)
  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      const pageCanvas = pageCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!pageCanvas || !overlayCanvas) return;

      // Cancel any in-flight render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        if (cancelled) return;
        pageRef.current = page;

        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * dpr });
        const displayWidth = viewport.width / dpr;
        const displayHeight = viewport.height / dpr;

        // Store viewport info for coordinate conversion
        viewportRef.current = {
          width: displayWidth,
          height: displayHeight,
          offsetX: viewport.offsetX,
          offsetY: viewport.offsetY,
        };

        // Setup page canvas
        pageCanvas.width = viewport.width;
        pageCanvas.height = viewport.height;
        pageCanvas.style.width = `${displayWidth}px`;
        pageCanvas.style.height = `${displayHeight}px`;

        // Setup overlay canvas
        overlayCanvas.width = viewport.width;
        overlayCanvas.height = viewport.height;
        overlayCanvas.style.width = `${displayWidth}px`;
        overlayCanvas.style.height = `${displayHeight}px`;

        const renderTask = page.render({
          canvas: pageCanvas,
          viewport: page.getViewport({ scale: scale * dpr }),
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (e) {
        if ((e as { name?: string })?.name === "RenderingCancelledException") return;
        if (!cancelled) console.error("PDF page render error:", e);
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, pageIndex, scale]);

  // Draw highlight overlay (cheap redraw every word change)
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    const page = pageRef.current;
    if (!overlayCanvas || !page) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = overlayCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Only highlight if the current word is on this page
    if (currentWordIndex < pageStartWord || currentWordIndex > pageEndWord) return;

    const pdfWord = words[currentWordIndex];
    if (!pdfWord || pdfWord.pageIndex !== pageIndex) return;

    const viewport = page.getViewport({ scale });
    const { pdfRect } = pdfWord;

    // Convert PDF coordinates to canvas coordinates
    // PDF coords: origin bottom-left; canvas: origin top-left
    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([
      pdfRect.x,
      pdfRect.y,
      pdfRect.x + pdfRect.width,
      pdfRect.y + pdfRect.height,
    ]);

    const rx = Math.min(x1, x2) * dpr;
    const ry = Math.min(y1, y2) * dpr;
    const rw = Math.abs(x2 - x1) * dpr;
    const rh = Math.abs(y2 - y1) * dpr;

    ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
    ctx.fillRect(rx, ry, rw, rh);
  }, [currentWordIndex, pageIndex, pageStartWord, pageEndWord, words, scale]);

  // Click handler: find closest word
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const page = pageRef.current;
      if (!page) return;

      const canvas = overlayCanvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;

      const viewport = page.getViewport({ scale });
      const [pdfX, pdfY] = viewport.convertToPdfPoint(canvasX, canvasY);

      // Find closest word on this page
      let bestIdx = -1;
      let bestDist = Infinity;

      for (let i = pageStartWord; i <= pageEndWord; i++) {
        const w = words[i];
        if (!w || w.pageIndex !== pageIndex) continue;
        const cx = w.pdfRect.x + w.pdfRect.width / 2;
        const cy = w.pdfRect.y + w.pdfRect.height / 2;
        const dist = (pdfX - cx) ** 2 + (pdfY - cy) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        onWordClick(bestIdx);
      }
    },
    [words, pageIndex, pageStartWord, pageEndWord, scale, onWordClick]
  );

  return (
    <div className="relative inline-block">
      <canvas ref={pageCanvasRef} className="block" />
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0 cursor-pointer"
        onClick={handleClick}
      />
    </div>
  );
}
