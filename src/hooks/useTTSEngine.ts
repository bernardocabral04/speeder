import { useState, useCallback, useEffect } from "react";
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
 * Unified TTS hook that delegates to browser or Azure provider.
 */
export function useTTSEngine({ onWordBoundary, onEnd }: UseTTSEngineOptions) {
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<TTSProvider>(getSelectedProvider);
  const [azureConfig, setAzureConfig] = useState<AzureConfig | null>(getAzureConfig);
  const [kokoroConfig, setKokoroConfig] = useState<KokoroConfig | null>(getKokoroConfig);

  const browser = useTTS({ onWordBoundary, onEnd });
  const azure = useAzureTTS({ config: azureConfig, onWordBoundary, onEnd });
  const kokoro = useKokoroTTS({ config: kokoroConfig, onWordBoundary, onEnd });

  const isAzure = provider === "azure" && azure.ready;
  const isKokoro = provider === "kokoro" && kokoro.ready;
  const activeProvider = isKokoro ? kokoro : isAzure ? azure : browser;
  const speaking = activeProvider.speaking;
  const rate = activeProvider.rate;

  const speak = useCallback(
    (words: string[], fromIndex: number) => {
      activeProvider.speak(words, fromIndex);
    },
    [activeProvider]
  );

  const stop = useCallback(() => {
    activeProvider.stop();
  }, [activeProvider]);

  const setRate = useCallback(
    (rateOrUpdater: number | ((prev: number) => number)) => {
      activeProvider.setRate(rateOrUpdater);
    },
    [activeProvider]
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

  // Stop speech on unmount
  useEffect(() => {
    return () => {
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
  } as const;
}
