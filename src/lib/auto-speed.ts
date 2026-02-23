const STORAGE_KEY = "speed-reader-auto-speed";

export interface AutoSpeedConfig {
  everyNWords: number; // 0 = disabled
  wpmBump: number;     // e.g. 10 → +10 WPM per interval (RSVP mode)
  rateBump: number;    // e.g. 0.05 → +0.05x per interval (TTS mode)
}

export const DEFAULT_AUTO_SPEED: AutoSpeedConfig = {
  everyNWords: 0,
  wpmBump: 10,
  rateBump: 0.05,
};

export function getAutoSpeedConfig(): AutoSpeedConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_AUTO_SPEED, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_AUTO_SPEED };
}

export function saveAutoSpeedConfig(config: AutoSpeedConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
