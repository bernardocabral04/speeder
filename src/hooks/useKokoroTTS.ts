import { useState, useCallback, useRef, useEffect } from "react";
import type { KokoroConfig } from "@/lib/tts-providers";
import { isSentenceEnd } from "@/lib/rsvp";

const MIN_CHUNK_WORDS = 15;
const MAX_CHUNK_WORDS = 80;

interface WordTiming {
  wordIndex: number;
  audioOffsetMs: number;
}

interface ChunkResult {
  audioBlob: Blob;
  timings: WordTiming[];
  startIndex: number;
  chunkLen: number;
}

interface ServerTimestamp {
  word: string;
  start: number;
  end: number;
}

interface UseKokoroTTSOptions {
  config: KokoroConfig | null;
  onWordBoundary: (wordIndex: number) => void;
  onEnd: () => void;
}

function getChunkLength(words: string[], fromIndex: number): number {
  const remaining = words.length - fromIndex;
  if (remaining <= MIN_CHUNK_WORDS) return remaining;

  let lastSentenceEnd = 0;

  for (let i = 0; i < Math.min(remaining, MAX_CHUNK_WORDS); i++) {
    const word = words[fromIndex + i];
    if (isSentenceEnd(word)) {
      lastSentenceEnd = i + 1;
      if (lastSentenceEnd >= MIN_CHUNK_WORDS) {
        return lastSentenceEnd;
      }
    }
  }

  if (lastSentenceEnd > 0) return lastSentenceEnd;
  return Math.min(remaining, MAX_CHUNK_WORDS);
}

export function useKokoroTTS({ config, onWordBoundary, onEnd }: UseKokoroTTSOptions) {
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState(1);
  const onWordBoundaryRef = useRef(onWordBoundary);
  onWordBoundaryRef.current = onWordBoundary;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const stoppedRef = useRef(false);
  const allWordsRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const lastReportedRef = useRef(-1);
  const prefetchedRef = useRef<ChunkResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    lastReportedRef.current = -1;
    prefetchedRef.current = null;
  }, []);

  /**
   * Synthesize a chunk via the local Kokoro server.
   */
  const synthesizeChunk = useCallback(
    async (startIndex: number, signal?: AbortSignal): Promise<ChunkResult | null> => {
      if (!config?.serverUrl) return null;

      const words = allWordsRef.current;
      if (startIndex >= words.length) return null;

      const chunkLen = getChunkLength(words, startIndex);
      const chunkWords = words.slice(startIndex, startIndex + chunkLen);
      const text = chunkWords.join(" ");

      try {
        const res = await fetch(`${config.serverUrl}/synthesize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voice: config.voiceName,
            speed: rateRef.current,
          }),
          signal,
        });

        if (!res.ok) return null;

        const data = await res.json();
        if (!data.audio) return null;

        // Decode base64 WAV to Blob
        const raw = atob(data.audio);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
          bytes[i] = raw.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes], { type: "audio/wav" });

        // Convert server timestamps to word timings
        const serverTimestamps: ServerTimestamp[] = data.timestamps ?? [];
        const timings: WordTiming[] = [];

        // Map each server timestamp to the corresponding word index in allWords
        for (let i = 0; i < Math.min(serverTimestamps.length, chunkLen); i++) {
          timings.push({
            wordIndex: startIndex + i,
            audioOffsetMs: serverTimestamps[i].start * 1000,
          });
        }

        return { audioBlob, timings, startIndex, chunkLen };
      } catch (err) {
        console.warn("Kokoro TTS error:", err);
        return null;
      }
    },
    [config]
  );

  /**
   * Play a chunk's audio and sync word display.
   */
  const playChunk = useCallback(
    (chunk: ChunkResult, onFinished: () => void) => {
      const url = URL.createObjectURL(chunk.audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      const syncLoop = () => {
        if (stoppedRef.current || !audioRef.current) return;

        const currentTimeMs = audio.currentTime * 1000;
        let matchIdx = -1;
        for (let i = chunk.timings.length - 1; i >= 0; i--) {
          if (chunk.timings[i].audioOffsetMs <= currentTimeMs) {
            matchIdx = i;
            break;
          }
        }

        if (matchIdx >= 0 && chunk.timings[matchIdx].wordIndex !== lastReportedRef.current) {
          lastReportedRef.current = chunk.timings[matchIdx].wordIndex;
          onWordBoundaryRef.current(chunk.timings[matchIdx].wordIndex);
        }

        rafRef.current = requestAnimationFrame(syncLoop);
      };

      audio.onplay = () => {
        setLoading(false);
        rafRef.current = requestAnimationFrame(syncLoop);
      };

      audio.onended = () => {
        cancelAnimationFrame(rafRef.current);
        if (chunk.timings.length > 0) {
          const last = chunk.timings[chunk.timings.length - 1];
          if (last.wordIndex !== lastReportedRef.current) {
            onWordBoundaryRef.current(last.wordIndex);
            lastReportedRef.current = last.wordIndex;
          }
        }
        URL.revokeObjectURL(url);
        audioRef.current = null;
        onFinished();
      };

      audio.onerror = () => {
        cancelAnimationFrame(rafRef.current);
        URL.revokeObjectURL(url);
        audioRef.current = null;
        onFinished();
      };

      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        onFinished();
      });
    },
    []
  );

  /**
   * Pipeline: play current chunk while pre-synthesizing the next one.
   */
  const playFromIndex = useCallback(
    async (startIndex: number) => {
      const words = allWordsRef.current;
      if (!config?.serverUrl) return;

      if (startIndex >= words.length || stoppedRef.current) {
        setSpeaking(false);
        onEndRef.current();
        return;
      }

      const gen = generationRef.current;

      // Create a new abort controller for this playback session
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      // Use prefetched chunk if available and matches
      let chunk: ChunkResult | null = null;
      if (prefetchedRef.current?.startIndex === startIndex) {
        chunk = prefetchedRef.current;
        prefetchedRef.current = null;
      } else {
        prefetchedRef.current = null;
        chunk = await synthesizeChunk(startIndex, ac.signal);
      }

      if (!chunk || stoppedRef.current || ac.signal.aborted || gen !== generationRef.current) {
        if (gen === generationRef.current) setSpeaking(false);
        return;
      }

      const nextStartIndex = chunk.startIndex + chunk.chunkLen;

      // Pre-synthesize next chunk in parallel with playback
      let prefetchPromise: Promise<ChunkResult | null> | null = null;
      if (nextStartIndex < words.length) {
        prefetchPromise = synthesizeChunk(nextStartIndex, ac.signal);
      }

      playChunk(chunk, async () => {
        if (stoppedRef.current || gen !== generationRef.current) return;

        if (prefetchPromise) {
          const prefetched = await prefetchPromise;
          if (!stoppedRef.current && gen === generationRef.current && prefetched) {
            prefetchedRef.current = prefetched;
          }
        }

        if (gen !== generationRef.current) return;
        playFromIndex(nextStartIndex);
      });
    },
    [config, synthesizeChunk, playChunk]
  );

  const speak = useCallback(
    (words: string[], fromIndex: number) => {
      if (!config?.serverUrl) return;

      cleanup();
      generationRef.current += 1;
      stoppedRef.current = false;
      allWordsRef.current = words;
      setLoading(true);
      setSpeaking(true);
      playFromIndex(fromIndex);
    },
    [config, cleanup, playFromIndex]
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    cleanup();
    setLoading(false);
    setSpeaking(false);
  }, [cleanup]);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  return {
    speaking,
    loading,
    rate,
    speak,
    stop,
    setRate,
    ready: !!config?.serverUrl,
  } as const;
}
