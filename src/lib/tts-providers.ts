export type TTSProvider = "browser" | "azure" | "kokoro";

export interface AzureConfig {
  subscriptionKey: string;
  region: string;
  voiceName: string;
}

export interface KokoroConfig {
  serverUrl: string;
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

const KOKORO_CONFIG_KEY = "speed-reader-kokoro-config";

export function getKokoroConfig(): KokoroConfig | null {
  try {
    const raw = localStorage.getItem(KOKORO_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as KokoroConfig;
  } catch {
    return null;
  }
}

export function saveKokoroConfig(config: KokoroConfig): void {
  localStorage.setItem(KOKORO_CONFIG_KEY, JSON.stringify(config));
}

export const KOKORO_VOICES = [
  { id: "af_heart", label: "Heart (US, Female)" },
  { id: "af_bella", label: "Bella (US, Female)" },
  { id: "af_nicole", label: "Nicole (US, Female)" },
  { id: "af_sarah", label: "Sarah (US, Female)" },
  { id: "af_sky", label: "Sky (US, Female)" },
  { id: "am_adam", label: "Adam (US, Male)" },
  { id: "am_michael", label: "Michael (US, Male)" },
  { id: "bf_emma", label: "Emma (UK, Female)" },
  { id: "bf_isabella", label: "Isabella (UK, Female)" },
  { id: "bm_george", label: "George (UK, Male)" },
  { id: "bm_lewis", label: "Lewis (UK, Male)" },
  { id: "pf_dora", label: "Dora (BR, Female)" },
  { id: "pm_alex", label: "Alex (BR, Male)" },
  { id: "pm_santa", label: "Santa (BR, Male)" },
] as const;

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
