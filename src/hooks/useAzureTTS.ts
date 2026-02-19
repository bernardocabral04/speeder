import { useState, useCallback, useRef, useEffect } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import type { AzureConfig } from "@/lib/tts-providers";
import { isSentenceEnd } from "@/lib/rsvp";

// Sentence-based chunking: each chunk is 1+ complete sentences.
// Target ~20-60 words per chunk for natural prosody without waste.
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

interface UseAzureTTSOptions {
  config: AzureConfig | null;
  onWordBoundary: (wordIndex: number) => void;
  onEnd: () => void;
}

/**
 * Find chunk length by collecting complete sentences.
 * Keeps adding sentences until we reach MIN_CHUNK_WORDS,
 * then stops at the next sentence boundary (up to MAX_CHUNK_WORDS).
 * Falls back to MAX_CHUNK_WORDS if no sentence boundary is found.
 */
function getChunkLength(words: string[], fromIndex: number): number {
  const remaining = words.length - fromIndex;
  if (remaining <= MIN_CHUNK_WORDS) return remaining;

  let lastSentenceEnd = 0;

  for (let i = 0; i < Math.min(remaining, MAX_CHUNK_WORDS); i++) {
    const word = words[fromIndex + i];
    if (isSentenceEnd(word)) {
      lastSentenceEnd = i + 1;
      // If we've collected enough words, stop at this sentence boundary
      if (lastSentenceEnd >= MIN_CHUNK_WORDS) {
        return lastSentenceEnd;
      }
    }
  }

  // If we found at least one sentence boundary, use it
  if (lastSentenceEnd > 0) return lastSentenceEnd;

  // No sentence boundary found (e.g. very long sentence) — cap at max
  return Math.min(remaining, MAX_CHUNK_WORDS);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function useAzureTTS({ config, onWordBoundary, onEnd }: UseAzureTTSOptions) {
  const [speaking, setSpeaking] = useState(false);
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
   * Synthesize a chunk: returns audio blob + word timings.
   */
  const synthesizeChunk = useCallback(
    (startIndex: number, voiceName: string): Promise<ChunkResult | null> => {
      if (!config?.subscriptionKey || !config?.region) return Promise.resolve(null);

      const words = allWordsRef.current;
      if (startIndex >= words.length) return Promise.resolve(null);

      const chunkLen = getChunkLength(words, startIndex);
      const chunkWords = words.slice(startIndex, startIndex + chunkLen);

      const escapedWords = chunkWords.map((w) => escapeXml(w));
      const escapedText = escapedWords.join(" ");

      const wordOffsets: number[] = [];
      let pos = 0;
      for (const ew of escapedWords) {
        wordOffsets.push(pos);
        pos += ew.length + 1;
      }

      const ssmlPrefix = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voiceName}"><prosody rate="${rateRef.current.toFixed(1)}">`;
      const ssmlSuffix = `</prosody></voice></speak>`;
      const ssml = ssmlPrefix + escapedText + ssmlSuffix;
      const prefixLen = ssmlPrefix.length;

      return new Promise((resolve) => {
        const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
          config.subscriptionKey,
          config.region
        );
        speechConfig.speechSynthesisVoiceName = voiceName;
        speechConfig.speechSynthesisOutputFormat =
          SpeechSDK.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

        const synth = new SpeechSDK.SpeechSynthesizer(
          speechConfig,
          null as unknown as SpeechSDK.AudioConfig
        );

        const timings: WordTiming[] = [];
        let lastRecordedWord = -1;

        synth.wordBoundary = (_s, e) => {
          const offsetInText = e.textOffset - prefixLen;
          if (offsetInText < 0) return;

          let wordIdx = 0;
          for (let i = wordOffsets.length - 1; i >= 0; i--) {
            if (wordOffsets[i] <= offsetInText) {
              wordIdx = i;
              break;
            }
          }

          if (wordIdx !== lastRecordedWord) {
            lastRecordedWord = wordIdx;
            timings.push({
              wordIndex: startIndex + wordIdx,
              audioOffsetMs: Number(e.audioOffset) / 10000,
            });
          }
        };

        synth.speakSsmlAsync(
          ssml,
          (result) => {
            synth.close();
            if (
              result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted &&
              result.audioData &&
              result.audioData.byteLength > 0
            ) {
              resolve({
                audioBlob: new Blob([result.audioData], { type: "audio/mpeg" }),
                timings,
                startIndex,
                chunkLen,
              });
            } else {
              resolve(null);
            }
          },
          (err) => {
            synth.close();
            console.warn("Azure TTS error:", err);
            resolve(null);
          }
        );
      });
    },
    [config]
  );

  /**
   * Play a chunk's audio and sync word display. Calls onFinished when done.
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
      if (!config?.subscriptionKey || !config?.region) return;

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

      // Use prefetched chunk if available and matches, otherwise synthesize
      let chunk: ChunkResult | null = null;
      if (prefetchedRef.current?.startIndex === startIndex) {
        chunk = prefetchedRef.current;
        prefetchedRef.current = null;
      } else {
        prefetchedRef.current = null;
        chunk = await synthesizeChunk(startIndex, config.voiceName);
      }

      if (!chunk || stoppedRef.current || ac.signal.aborted || gen !== generationRef.current) {
        if (gen === generationRef.current) setSpeaking(false);
        return;
      }

      const nextStartIndex = chunk.startIndex + chunk.chunkLen;

      // Start pre-synthesizing the next chunk in parallel with playback
      let prefetchPromise: Promise<ChunkResult | null> | null = null;
      if (nextStartIndex < words.length) {
        prefetchPromise = synthesizeChunk(nextStartIndex, config.voiceName);
      }

      // Play current chunk
      playChunk(chunk, async () => {
        if (stoppedRef.current || gen !== generationRef.current) return;

        // Store prefetched result if ready
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
      if (!config?.subscriptionKey || !config?.region) return;

      cleanup();
      generationRef.current += 1;
      stoppedRef.current = false;
      allWordsRef.current = words;
      setSpeaking(true);
      playFromIndex(fromIndex);
    },
    [config, cleanup, playFromIndex]
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    cleanup();
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
    rate,
    speak,
    stop,
    setRate,
    ready: !!config?.subscriptionKey && !!config?.region,
  } as const;
}
