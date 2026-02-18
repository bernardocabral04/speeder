import { getDocument } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
// Worker is configured as a singleton in pdf.ts — import it to ensure setup runs
import "./pdf";
import type { PdfWord, PageWordRange } from "./pdf-store";

export interface PdfExtractionResult {
  text: string;
  words: PdfWord[];
  pageWordRanges: PageWordRange[];
  numPages: number;
}

export async function extractPdfWithPositions(
  file: File
): Promise<PdfExtractionResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer.slice(0) }).promise;

  const allWords: PdfWord[] = [];
  const pageWordRanges: PageWordRange[] = [];
  const pageTexts: string[] = [];

  for (let pageIdx = 0; pageIdx < pdf.numPages; pageIdx++) {
    const page = await pdf.getPage(pageIdx + 1); // pdfjs is 1-indexed
    const content = await page.getTextContent();
    const startWordIndex = allWords.length;
    const pageStrings: string[] = [];

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const textItem = item as TextItem;
      const str = textItem.str;
      if (!str.trim()) continue;

      // transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const tx = textItem.transform[4];
      const ty = textItem.transform[5];
      const itemWidth = textItem.width;
      const itemHeight = textItem.height;

      const tokens = str.split(/(\s+)/);
      let charOffset = 0;

      for (const token of tokens) {
        const trimmed = token.trim();
        if (!trimmed) {
          charOffset += token.length;
          continue;
        }

        const totalChars = str.length || 1;
        const wordX = tx + (charOffset / totalChars) * itemWidth;
        const wordW = (trimmed.length / totalChars) * itemWidth;

        allWords.push({
          word: trimmed,
          pageIndex: pageIdx,
          pdfRect: {
            x: wordX,
            y: ty,
            width: wordW,
            height: itemHeight,
          },
        });
        pageStrings.push(trimmed);
        charOffset += token.length;
      }
    }

    pageWordRanges.push({
      pageIndex: pageIdx,
      startWordIndex,
      endWordIndex: allWords.length - 1,
    });
    pageTexts.push(pageStrings.join(" "));
    page.cleanup();
  }

  pdf.destroy();

  const text = pageTexts.join(" ").replace(/\s+/g, " ").trim();

  return { text, words: allWords, pageWordRanges, numPages: pdf.numPages };
}
