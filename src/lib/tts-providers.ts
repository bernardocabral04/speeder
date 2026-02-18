export type TTSProvider = "browser" | "azure";

export interface AzureConfig {
  subscriptionKey: string;
  region: string;
  voiceName: string;
}

const AZURE_CONFIG_KEY = "speed-reader-azure-config";

export function getAzureConfig(): AzureConfig | null {
  try {
    const raw = localStorage.getItem(AZURE_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AzureConfig;
  } catch {
    return null;
  }
}

export function saveAzureConfig(config: AzureConfig): void {
  localStorage.setItem(AZURE_CONFIG_KEY, JSON.stringify(config));
}

export function getSelectedProvider(): TTSProvider {
  return (localStorage.getItem("speed-reader-tts-provider") as TTSProvider) || "browser";
}

export function saveSelectedProvider(provider: TTSProvider): void {
  localStorage.setItem("speed-reader-tts-provider", provider);
}

// Popular Azure Neural voices
export const AZURE_VOICES = [
  { id: "en-US-AvaMultilingualNeural", label: "Ava (US, Female)" },
  { id: "en-US-AndrewMultilingualNeural", label: "Andrew (US, Male)" },
  { id: "en-US-EmmaMultilingualNeural", label: "Emma (US, Female)" },
  { id: "en-US-BrianMultilingualNeural", label: "Brian (US, Male)" },
  { id: "en-GB-SoniaNeural", label: "Sonia (UK, Female)" },
  { id: "en-GB-RyanNeural", label: "Ryan (UK, Male)" },
  { id: "en-AU-NatashaNeural", label: "Natasha (AU, Female)" },
  { id: "en-AU-WilliamNeural", label: "William (AU, Male)" },
  { id: "pt-BR-ThalitaMultilingualNeural", label: "Thalita (BR, Female)" },
  { id: "pt-BR-AntonioNeural", label: "Antonio (BR, Male)" },
  { id: "pt-BR-FranciscaNeural", label: "Francisca (BR, Female)" },
  { id: "pt-PT-RaquelNeural", label: "Raquel (PT, Female)" },
  { id: "pt-PT-DuarteNeural", label: "Duarte (PT, Male)" },
  { id: "pt-PT-FernandaNeural", label: "Fernanda (PT, Female)" },
] as const;
