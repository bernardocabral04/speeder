import { useState, useCallback, useEffect } from "react";
import { useTTS } from "./useTTS";
import { useAzureTTS } from "./useAzureTTS";
import {
  type TTSProvider,
  type AzureConfig,
  getSelectedProvider,
  getAzureConfig,
  saveSelectedProvider,
  saveAzureConfig,
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

  const browser = useTTS({ onWordBoundary, onEnd });
  const azure = useAzureTTS({ config: azureConfig, onWordBoundary, onEnd });

  const isAzure = provider === "azure" && azure.ready;
  const speaking = isAzure ? azure.speaking : browser.speaking;
  const rate = isAzure ? azure.rate : browser.rate;

  const speak = useCallback(
    (words: string[], fromIndex: number) => {
      if (isAzure) {
        azure.speak(words, fromIndex);
      } else {
        browser.speak(words, fromIndex);
      }
    },
    [isAzure, azure, browser]
  );

  const stop = useCallback(() => {
    if (isAzure) {
      azure.stop();
    } else {
      browser.stop();
    }
  }, [isAzure, azure, browser]);

  const setRate = useCallback(
    (rateOrUpdater: number | ((prev: number) => number)) => {
      if (isAzure) {
        azure.setRate(rateOrUpdater);
      } else {
        browser.setRate(rateOrUpdater);
      }
    },
    [isAzure, azure, browser]
  );

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      if (prev) {
        // Turning off — stop any active speech
        if (isAzure) azure.stop();
        else browser.stop();
      }
      return !prev;
    });
  }, [isAzure, azure, browser]);

  const updateProvider = useCallback(
    (newProvider: TTSProvider, newConfig: AzureConfig | null) => {
      // Stop current speech
      if (speaking) {
        if (isAzure) azure.stop();
        else browser.stop();
      }
      setProvider(newProvider);
      saveSelectedProvider(newProvider);
      if (newConfig) {
        setAzureConfig(newConfig);
        saveAzureConfig(newConfig);
      }
    },
    [speaking, isAzure, azure, browser]
  );

  // Stop speech on unmount
  useEffect(() => {
    return () => {
      browser.stop();
      azure.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    enabled,
    speaking,
    rate,
    provider,
    isAzure,
    azureConfig,
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
