/**
 * Test whether a word ends a sentence.
 * Handles trailing quotes/parens after punctuation (e.g. `word."` or `word)"`).
 */
export function isSentenceEnd(word: string): boolean {
  return /[.!?]["'\u201D\u2019)]*$/.test(word);
}

/**
 * Calculate the Optimal Recognition Point (ORP) index for a word.
 * The eye naturally fixates slightly left of center (~35-40% through the word).
 * This keeps the word visually balanced around the center guide line.
 */
export function getORPIndex(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 3) return 1;
  // ~38% of the way through the word, floored
  return Math.floor(len * 0.38);
}

/**
 * Split text into an array of words, preserving order.
 */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Find the start of the current sentence (scan backwards for sentence-ending punctuation).
 */
export function findSentenceStart(words: string[], fromIndex: number): number {
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (isSentenceEnd(words[i])) {
      return i + 1;
    }
  }
  return 0;
}

/**
 * Find the start of the next sentence (scan forward for sentence-ending punctuation).
 */
export function findNextSentenceStart(words: string[], fromIndex: number): number {
  for (let i = fromIndex; i < words.length; i++) {
    if (isSentenceEnd(words[i])) {
      return Math.min(i + 1, words.length - 1);
    }
  }
  return words.length - 1;
}

/**
 * Skip backward by paragraph (~50 words).
 */
export function skipParagraphBack(currentIndex: number): number {
  return Math.max(0, currentIndex - 50);
}

/**
 * Skip forward by paragraph (~50 words).
 */
export function skipParagraphForward(currentIndex: number, totalWords: number): number {
  return Math.min(totalWords - 1, currentIndex + 50);
}
