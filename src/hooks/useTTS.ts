import { useState, useCallback, useRef, useEffect } from "react";
import { isSentenceEnd } from "@/lib/rsvp";

const CHUNK_SIZE = 40; // words per utterance — small enough to avoid browser limits

interface UseTTSOptions {
  onWordBoundary: (wordIndex: number) => void;
  onEnd: () => void;
}

/**
 * Split words into a chunk that ends at a sentence boundary when possible.
 * Returns the number of words in the chunk.
 */
function getChunkLength(words: string[], fromIndex: number): number {
  const remaining = words.length - fromIndex;
  if (remaining <= CHUNK_SIZE) return remaining;

  // Look for a sentence end (.!?) near CHUNK_SIZE to break naturally
  for (let i = fromIndex + CHUNK_SIZE - 1; i >= fromIndex + CHUNK_SIZE - 15; i--) {
    if (i < words.length && isSentenceEnd(words[i])) {
      return i - fromIndex + 1;
    }
  }
  return Math.min(CHUNK_SIZE, remaining);
}

function buildUtterance(
  words: string[],
  startIndex: number,
  refs: {
    rate: React.RefObject<number>;
    voice: React.RefObject<SpeechSynthesisVoice | null>;
    chunkStart: React.RefObject<number>;
    stopped: React.RefObject<boolean>;
    allWords: React.RefObject<string[]>;
    onWordBoundary: React.RefObject<(idx: number) => void>;
    onEnd: React.RefObject<() => void>;
    setSpeaking: (v: boolean) => void;
    speakNext: (startIndex: number) => void;
  }
): SpeechSynthesisUtterance | null {
  if (startIndex >= words.length || refs.stopped.current) {
    refs.setSpeaking(false);
    refs.onEnd.current();
    return null;
  }

  const chunkLen = getChunkLength(words, startIndex);
  const chunk = words.slice(startIndex, startIndex + chunkLen);
  const text = chunk.join(" ");

  const offsets: number[] = [];
  let offset = 0;
  for (const word of chunk) {
    offsets.push(offset);
    offset += word.length + 1;
  }
  refs.chunkStart.current = startIndex;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = refs.rate.current;
  if (refs.voice.current) utterance.voice = refs.voice.current;

  utterance.onboundary = (event) => {
    if (event.name === "word") {
      const charIndex = event.charIndex;
      let wordIdx = 0;
      for (let i = offsets.length - 1; i >= 0; i--) {
        if (offsets[i] <= charIndex) {
          wordIdx = i;
          break;
        }
      }
      refs.onWordBoundary.current(refs.chunkStart.current + wordIdx);
    }
  };

  utterance.onend = () => {
    if (refs.stopped.current) {
      refs.setSpeaking(false);
      return;
    }
    refs.speakNext(startIndex + chunkLen);
  };

  utterance.onerror = (event) => {
    if (event.error !== "interrupted" && event.error !== "canceled") {
      console.warn("TTS error:", event.error);
    }
    refs.setSpeaking(false);
  };

  return utterance;
}

export function useTTS({ onWordBoundary, onEnd }: UseTTSOptions) {
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const onWordBoundaryRef = useRef(onWordBoundary);
  onWordBoundaryRef.current = onWordBoundary;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const selectedVoiceRef = useRef(selectedVoice);
  selectedVoiceRef.current = selectedVoice;

  const allWordsRef = useRef<string[]>([]);
  const chunkStartRef = useRef(0);
  const stoppedRef = useRef(false);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const available = speechSynthesis.getVoices();
      setVoices(available);
      if (available.length > 0) {
        setSelectedVoice((prev) => {
          if (prev) return prev;
          return (
            available.find((v) => v.default && v.lang.startsWith("en")) ||
            available.find((v) => v.lang.startsWith("en")) ||
            available[0]
          );
        });
      }
    };
    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // Shared refs object for buildUtterance
  const refsForBuild = useRef({
    rate: rateRef,
    voice: selectedVoiceRef,
    chunkStart: chunkStartRef,
    stopped: stoppedRef,
    allWords: allWordsRef,
    onWordBoundary: onWordBoundaryRef,
    onEnd: onEndRef,
    setSpeaking,
    speakNext: (_startIndex: number) => {},
  });
  refsForBuild.current.setSpeaking = setSpeaking;

  // This function is called from onend to continue to the next chunk.
  // It's NOT called from user gesture, but that's fine — only the first
  // speechSynthesis.speak() needs a gesture, subsequent ones are allowed.
  const speakNextChunk = useCallback((startIndex: number) => {
    const words = allWordsRef.current;
    const utterance = buildUtterance(words, startIndex, refsForBuild.current);
    if (utterance) {
      speechSynthesis.speak(utterance);
    }
  }, []);
  refsForBuild.current.speakNext = speakNextChunk;

  // speak() is called synchronously from a click handler — no setTimeout.
  // The first speechSynthesis.speak() MUST be in the user gesture call stack.
  const speak = useCallback(
    (words: string[], fromIndex: number) => {
      // Stop any current speech
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel();
      }

      stoppedRef.current = false;
      allWordsRef.current = words;

      const utterance = buildUtterance(words, fromIndex, refsForBuild.current);
      if (utterance) {
        setSpeaking(true);
        // Called synchronously — preserves user gesture context
        speechSynthesis.speak(utterance);
      }
    },
    [refsForBuild]
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      if (prev) {
        stoppedRef.current = true;
        speechSynthesis.cancel();
        setSpeaking(false);
      }
      return !prev;
    });
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      speechSynthesis.cancel();
    };
  }, []);

  return {
    enabled,
    speaking,
    rate,
    voices,
    selectedVoice,
    speak,
    stop,
    setRate,
    setSelectedVoice,
    toggleEnabled,
  } as const;
}
