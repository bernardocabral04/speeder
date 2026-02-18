import { useState, useCallback, useRef, useEffect } from "react";
import {
  splitWords,
  isSentenceEnd,
  findSentenceStart,
  findNextSentenceStart,
  skipParagraphBack,
  skipParagraphForward,
} from "@/lib/rsvp";

interface UseRSVPOptions {
  text: string;
  initialIndex?: number;
  initialWpm?: number;
  onProgress?: (index: number, wpm: number) => void;
}

/**
 * Get a duration multiplier for a word based on its complexity.
 * Longer words and words with punctuation get more display time.
 */
function getWordComplexity(word: string): number {
  const len = word.length;
  let multiplier: number;

  if (len <= 3) multiplier = 0.8;
  else if (len <= 6) multiplier = 1.0;
  else if (len <= 9) multiplier = 1.3;
  else if (len <= 13) multiplier = 1.6;
  else multiplier = 1.9;

  if (isSentenceEnd(word)) multiplier += 0.4;
  else if (/[,;:]$/.test(word)) multiplier += 0.2;

  return multiplier;
}

export function useRSVP({ text, initialIndex = 0, initialWpm = 300, onProgress }: UseRSVPOptions) {
  const words = useRef(splitWords(text));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [wpm, setWpm] = useState(initialWpm);
  const [playing, setPlaying] = useState(false);
  const [adaptive, setAdaptive] = useState(false);
  const [effectiveWpm, setEffectiveWpm] = useState(initialWpm);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const wpmRef = useRef(wpm);
  wpmRef.current = wpm;
  const adaptiveRef = useRef(adaptive);
  adaptiveRef.current = adaptive;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const totalWords = words.current.length;
  const currentWord = words.current[currentIndex] ?? "";
  const progress = totalWords > 0 ? currentIndex / totalWords : 0;

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    setPlaying(false);
    clearTimer();
  }, [clearTimer]);

  const play = useCallback(() => {
    if (currentIndex >= totalWords - 1) return;
    setPlaying(true);
  }, [currentIndex, totalWords]);

  const togglePlay = useCallback(() => {
    if (playing) {
      stop();
    } else {
      play();
    }
  }, [playing, stop, play]);

  // Playback loop using setTimeout chain for per-word timing
  useEffect(() => {
    if (!playing) return;

    const tick = () => {
      const idx = currentIndexRef.current;
      const word = words.current[idx] ?? "";
      const baseMs = 60000 / wpmRef.current;
      const multiplier = adaptiveRef.current ? getWordComplexity(word) : 1;
      const ms = baseMs * multiplier;

      // Update the effective WPM for display
      const actualWpm = Math.round(60000 / ms);
      setEffectiveWpm(actualWpm);

      timeoutRef.current = setTimeout(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= totalWords) {
            stop();
            return prev;
          }
          return next;
        });
        if (playingRef.current) {
          tick();
        }
      }, ms);
    };

    tick();

    return clearTimer;
  }, [playing, wpm, adaptive, totalWords, stop, clearTimer]);

  // Update effective WPM when paused and adaptive changes
  useEffect(() => {
    if (!playing && adaptive) {
      const word = words.current[currentIndex] ?? "";
      const baseMs = 60000 / wpm;
      const ms = baseMs * getWordComplexity(word);
      setEffectiveWpm(Math.round(60000 / ms));
    } else if (!adaptive) {
      setEffectiveWpm(wpm);
    }
  }, [adaptive, playing, currentIndex, wpm]);

  // Auto-save progress callback — uses refs so the interval is stable
  useEffect(() => {
    const id = setInterval(() => {
      onProgressRef.current?.(currentIndexRef.current, wpmRef.current);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const seekTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, totalWords - 1)));
    },
    [totalWords]
  );

  const skipSentenceBack = useCallback((): number => {
    const newIdx = findSentenceStart(words.current, currentIndexRef.current);
    setCurrentIndex(newIdx);
    return newIdx;
  }, []);

  const skipSentenceForward = useCallback((): number => {
    const newIdx = findNextSentenceStart(words.current, currentIndexRef.current);
    setCurrentIndex(newIdx);
    return newIdx;
  }, []);

  const skipParaBack = useCallback((): number => {
    const newIdx = skipParagraphBack(currentIndexRef.current);
    setCurrentIndex(newIdx);
    return newIdx;
  }, []);

  const skipParaForward = useCallback((): number => {
    const newIdx = skipParagraphForward(currentIndexRef.current, totalWords);
    setCurrentIndex(newIdx);
    return newIdx;
  }, [totalWords]);

  const adjustWpm = useCallback(
    (delta: number) => {
      setWpm((prev) => Math.max(50, Math.min(1000, prev + delta)));
    },
    []
  );

  const toggleAdaptive = useCallback(() => {
    setAdaptive((prev) => !prev);
  }, []);

  return {
    currentWord,
    currentIndex,
    totalWords,
    words: words.current,
    wpm,
    effectiveWpm,
    adaptive,
    playing,
    progress,
    play,
    stop,
    togglePlay,
    seekTo,
    skipSentenceBack,
    skipSentenceForward,
    skipParaBack,
    skipParaForward,
    setWpm,
    adjustWpm,
    toggleAdaptive,
  } as const;
}
