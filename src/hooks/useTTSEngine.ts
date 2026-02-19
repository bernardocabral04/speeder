import { useState, useCallback, useEffect, useRef } from "react";
import { useTTS } from "./useTTS";
import { useAzureTTS } from "./useAzureTTS";
import { useKokoroTTS } from "./useKokoroTTS";
import {
  type TTSProvider,
  type AzureConfig,
  type KokoroConfig,
  getSelectedProvider,
  getAzureConfig,
  getKokoroConfig,
  saveSelectedProvider,
  saveAzureConfig,
  saveKokoroConfig,
} from "@/lib/tts-providers";

interface UseTTSEngineOptions {
  onWordBoundary: (wordIndex: number) => void;
  onEnd: () => void;
}

/**
 * Unified TTS hook that delegates to browser, Azure, or Kokoro provider.
 */
export function useTTSEngine({ onWordBoundary, onEnd }: UseTTSEngineOptions) {
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<TTSProvider>(getSelectedProvider);
  const [azureConfig, setAzureConfig] = useState<AzureConfig | null>(getAzureConfig);
  const [kokoroConfig, setKokoroConfig] = useState<KokoroConfig | null>(getKokoroConfig);

  // Track playback position so we can restart on voice/rate changes
  const lastWordsRef = useRef<string[]>([]);
  const lastWordIndexRef = useRef(0);
  const onWordBoundaryRef = useRef(onWordBoundary);
  onWordBoundaryRef.current = onWordBoundary;

  const trackingWordBoundary = useCallback((wordIndex: number) => {
    lastWordIndexRef.current = wordIndex;
    onWordBoundaryRef.current(wordIndex);
  }, []);

  const browser = useTTS({ onWordBoundary: trackingWordBoundary, onEnd });
  const azure = useAzureTTS({ config: azureConfig, onWordBoundary: trackingWordBoundary, onEnd });
  const kokoro = useKokoroTTS({ config: kokoroConfig, onWordBoundary: trackingWordBoundary, onEnd });

  const isAzure = provider === "azure" && azure.ready;
  const isKokoro = provider === "kokoro" && kokoro.ready;
  const activeProvider = isKokoro ? kokoro : isAzure ? azure : browser;
  const speaking = activeProvider.speaking;
  const rate = activeProvider.rate;

  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;
  const restartTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const speak = useCallback(
    (words: string[], fromIndex: number) => {
      lastWordsRef.current = words;
      lastWordIndexRef.current = fromIndex;
      activeProvider.speak(words, fromIndex);
    },
    [activeProvider]
  );

  const stop = useCallback(() => {
    activeProvider.stop();
  }, [activeProvider]);

  const restartIfSpeaking = useCallback(() => {
    if ((speakingRef.current || restartTimerRef.current) && lastWordsRef.current.length > 0) {
      activeProvider.stop();
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = undefined;
        activeProvider.speak(lastWordsRef.current, lastWordIndexRef.current);
      }, 300);
    }
  }, [activeProvider]);

  const setRate = useCallback(
    (rateOrUpdater: number | ((prev: number) => number)) => {
      activeProvider.setRate(rateOrUpdater);
      restartIfSpeaking();
    },
    [activeProvider, restartIfSpeaking]
  );

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      if (prev) {
        activeProvider.stop();
      }
      return !prev;
    });
  }, [activeProvider]);

  const updateProvider = useCallback(
    (
      newProvider: TTSProvider,
      newAzureConfig: AzureConfig | null,
      newKokoroConfig: KokoroConfig | null,
    ) => {
      if (speaking) {
        activeProvider.stop();
      }
      setProvider(newProvider);
      saveSelectedProvider(newProvider);
      if (newAzureConfig) {
        setAzureConfig(newAzureConfig);
        saveAzureConfig(newAzureConfig);
      }
      if (newKokoroConfig) {
        setKokoroConfig(newKokoroConfig);
        saveKokoroConfig(newKokoroConfig);
      }
    },
    [speaking, activeProvider]
  );

  const setVoice = useCallback(
    (voiceName: string) => {
      if (provider === "azure" && azureConfig) {
        const updated = { ...azureConfig, voiceName };
        setAzureConfig(updated);
        saveAzureConfig(updated);
      } else if (provider === "kokoro" && kokoroConfig) {
        const updated = { ...kokoroConfig, voiceName };
        setKokoroConfig(updated);
        saveKokoroConfig(updated);
      }
      // Restart will happen via the useEffect below when config state updates
    },
    [provider, azureConfig, kokoroConfig]
  );

  // Restart speech when voice changes while speaking
  const prevAzureVoiceRef = useRef(azureConfig?.voiceName);
  const prevKokoroVoiceRef = useRef(kokoroConfig?.voiceName);
  const prevBrowserVoiceRef = useRef(browser.selectedVoice);
  useEffect(() => {
    const azureVoiceChanged = azureConfig?.voiceName !== prevAzureVoiceRef.current;
    const kokoroVoiceChanged = kokoroConfig?.voiceName !== prevKokoroVoiceRef.current;
    const browserVoiceChanged = browser.selectedVoice !== prevBrowserVoiceRef.current;
    prevAzureVoiceRef.current = azureConfig?.voiceName;
    prevKokoroVoiceRef.current = kokoroConfig?.voiceName;
    prevBrowserVoiceRef.current = browser.selectedVoice;

    const isBrowser = !isAzure && !isKokoro;
    const voiceChanged =
      (azureVoiceChanged && isAzure) ||
      (kokoroVoiceChanged && isKokoro) ||
      (browserVoiceChanged && isBrowser);

    if (voiceChanged && speakingRef.current && lastWordsRef.current.length > 0) {
      activeProvider.stop();
      activeProvider.speak(lastWordsRef.current, lastWordIndexRef.current);
    }
  }, [azureConfig?.voiceName, kokoroConfig?.voiceName, browser.selectedVoice, isAzure, isKokoro, activeProvider]);

  // Stop speech on unmount
  useEffect(() => {
    return () => {
      clearTimeout(restartTimerRef.current);
      browser.stop();
      azure.stop();
      kokoro.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    enabled,
    speaking,
    rate,
    provider,
    isAzure,
    isKokoro,
    azureConfig,
    kokoroConfig,
    // Browser-specific (for voice selector when using browser TTS)
    browserVoices: browser.voices,
    selectedBrowserVoice: browser.selectedVoice,
    setSelectedBrowserVoice: browser.setSelectedVoice,
    // Actions
    speak,
    stop,
    setRate,
    toggleEnabled,
    updateProvider,
    setVoice,
  } as const;
}
