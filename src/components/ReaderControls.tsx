import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiArrowLeftDoubleLine,
  RiArrowRightDoubleLine,
  RiPlayFill,
  RiPauseFill,
  RiSubtractLine,
  RiAddLine,
  RiVolumeUpLine,
  RiVolumeMuteLine,
  RiSettings3Line,
  RiLoader4Line,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { AZURE_VOICES, KOKORO_VOICES } from "@/lib/tts-providers";

interface ReaderControlsProps {
  // Playback state
  isPlaying: boolean;
  ttsLoading: boolean;
  currentIndex: number;
  totalWords: number;
  // RSVP speed
  wpm: number;
  effectiveWpm: number;
  adaptive: boolean;
  // TTS state
  ttsEnabled: boolean;
  ttsRate: number;
  ttsIsAzure: boolean;
  ttsIsKokoro: boolean;
  ttsBrowserVoices: SpeechSynthesisVoice[];
  ttsSelectedBrowserVoice: SpeechSynthesisVoice | null;
  ttsAzureVoiceName: string | null;
  ttsKokoroVoiceName: string | null;
  // Layout
  compact?: boolean;
  // Actions
  onTogglePlay: () => void;
  onSeek: (index: number) => void;
  onSkipSentenceBack: () => void;
  onSkipSentenceForward: () => void;
  onSkipParaBack: () => void;
  onSkipParaForward: () => void;
  onAdjustWpm: (delta: number) => void;
  onSetWpm: (wpm: number) => void;
  onToggleAdaptive: () => void;
  onSetTTSRate: (rateOrUpdater: number | ((prev: number) => number)) => void;
  onToggleTTS: () => void;
  onSetBrowserVoice: (voice: SpeechSynthesisVoice) => void;
  onSetVoice: (voiceName: string) => void;
  onOpenSettings: () => void;
}

export function ReaderControls({
  isPlaying,
  ttsLoading,
  currentIndex,
  totalWords,
  wpm,
  effectiveWpm,
  adaptive,
  ttsEnabled,
  ttsRate,
  ttsIsAzure,
  ttsIsKokoro,
  ttsBrowserVoices,
  ttsSelectedBrowserVoice,
  ttsAzureVoiceName,
  ttsKokoroVoiceName,
  onTogglePlay,
  onSeek,
  onSkipSentenceBack,
  onSkipSentenceForward,
  onSkipParaBack,
  onSkipParaForward,
  onAdjustWpm,
  onSetWpm,
  onToggleAdaptive,
  onSetTTSRate,
  onToggleTTS,
  onSetBrowserVoice,
  onSetVoice,
  onOpenSettings,
  compact = false,
}: ReaderControlsProps) {
  const providerLabel = ttsIsKokoro ? "Kokoro" : ttsIsAzure ? "Azure" : "Browser";

  const remainingWords = totalWords - currentIndex;
  const estimatedMinutes = ttsEnabled
    ? remainingWords / (150 * ttsRate)
    : remainingWords / (effectiveWpm || wpm || 200);

  let timeLeft: string;
  if (estimatedMinutes < 1) {
    timeLeft = `~${Math.max(1, Math.round(estimatedMinutes * 60))} sec`;
  } else if (estimatedMinutes < 60) {
    timeLeft = `~${Math.round(estimatedMinutes)} min`;
  } else {
    const h = Math.floor(estimatedMinutes / 60);
    const m = Math.round(estimatedMinutes % 60);
    timeLeft = m > 0 ? `~${h}h ${m}min` : `~${h}h`;
  }

  const speedLabel = ttsEnabled
    ? `${ttsRate.toFixed(2)}x`
    : `${wpm} WPM`;

  if (compact) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full bg-muted/80 backdrop-blur-sm ring-1 ring-border px-2 py-1">
        {/* Nav buttons */}
        <Button variant="ghost" size="icon-xs" onClick={onSkipParaBack} title="Skip paragraph back">
          <RiArrowLeftDoubleLine className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={onSkipSentenceBack} title="Skip sentence back">
          <RiArrowLeftSLine className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={onTogglePlay} title={isPlaying ? "Pause" : "Play"}>
          {ttsLoading ? (
            <RiLoader4Line className="size-4 animate-spin" />
          ) : isPlaying ? (
            <RiPauseFill className="size-4" />
          ) : (
            <RiPlayFill className="size-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={onSkipSentenceForward} title="Skip sentence forward">
          <RiArrowRightSLine className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={onSkipParaForward} title="Skip paragraph forward">
          <RiArrowRightDoubleLine className="size-3.5" />
        </Button>

        {/* Divider */}
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Speed +/- */}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() =>
            ttsEnabled
              ? onSetTTSRate((r) => Math.max(0.5, +(r - 0.05).toFixed(2)))
              : onAdjustWpm(-10)
          }
          title="Decrease speed"
        >
          <RiSubtractLine className="size-3" />
        </Button>
        <span className="text-xs font-medium tabular-nums px-1 select-none">{speedLabel}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() =>
            ttsEnabled
              ? onSetTTSRate((r) => Math.min(4, +(r + 0.05).toFixed(2)))
              : onAdjustWpm(10)
          }
          title="Increase speed"
        >
          <RiAddLine className="size-3" />
        </Button>

        {/* Divider */}
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* TTS toggle */}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onToggleTTS}
          title={ttsEnabled ? `Read aloud on (${providerLabel})` : "Read aloud"}
          className={ttsEnabled ? "text-primary" : ""}
        >
          {ttsEnabled ? (
            <RiVolumeUpLine className="size-3.5" />
          ) : (
            <RiVolumeMuteLine className="size-3.5" />
          )}
        </Button>

        {/* Settings */}
        <Button variant="ghost" size="icon-xs" onClick={onOpenSettings} title="Settings">
          <RiSettings3Line className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-border p-4 space-y-3">
      {/* Progress bar */}
      <div className="group relative">
        <input
          type="range"
          min={0}
          max={totalWords - 1}
          value={currentIndex}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-125"
        />
        <span className="absolute right-0 -bottom-5 text-sm text-muted-foreground tabular-nums">
          {totalWords > 0 ? Math.round((currentIndex / (totalWords - 1)) * 100) : 0}% ({timeLeft})
        </span>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={onSkipParaBack} title="Skip paragraph back">
          <RiArrowLeftDoubleLine className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onSkipSentenceBack} title="Skip sentence back">
          <RiArrowLeftSLine className="size-5" />
        </Button>
        <Button variant="outline" size="icon" onClick={onTogglePlay} className="mx-2">
          {ttsLoading ? (
            <RiLoader4Line className="size-5 animate-spin" />
          ) : isPlaying ? (
            <RiPauseFill className="size-5" />
          ) : (
            <RiPlayFill className="size-5" />
          )}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onSkipSentenceForward} title="Skip sentence forward">
          <RiArrowRightSLine className="size-5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onSkipParaForward} title="Skip paragraph forward">
          <RiArrowRightDoubleLine className="size-4" />
        </Button>
      </div>

      {/* Speed control: WPM or TTS rate */}
      {ttsEnabled ? (
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" size="icon-xs" onClick={() => onSetTTSRate((r) => Math.max(0.5, +(r - 0.05).toFixed(2)))}>
            <RiSubtractLine className="size-3.5" />
          </Button>
          <div className="flex items-baseline gap-1">
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.05}
              value={ttsRate}
              onChange={(e) => onSetTTSRate(Number(e.target.value))}
              className="w-28 h-1 rounded-full appearance-none bg-muted cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="text-sm font-medium tabular-nums w-16 text-center">
              {ttsRate.toFixed(2)}x <span className="text-xs text-muted-foreground">rate</span>
            </span>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={() => onSetTTSRate((r) => Math.min(4, +(r + 0.05).toFixed(2)))}>
            <RiAddLine className="size-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center gap-3">
            <Button variant="ghost" size="icon-xs" onClick={() => onAdjustWpm(-10)}>
              <RiSubtractLine className="size-3.5" />
            </Button>
            <div className="flex items-baseline gap-1">
              <input
                type="range"
                min={50}
                max={1000}
                step={10}
                value={wpm}
                onChange={(e) => onSetWpm(Number(e.target.value))}
                className="w-28 h-1 rounded-full appearance-none bg-muted cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <span className="text-sm font-medium tabular-nums text-center">
                {wpm} <span className="text-xs text-muted-foreground">WPM</span>
                {adaptive && (
                  <span className="text-xs text-muted-foreground/60 ml-1 tabular-nums">
                    ({effectiveWpm})
                  </span>
                )}
              </span>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => onAdjustWpm(10)}>
              <RiAddLine className="size-3.5" />
            </Button>
          </div>

          {/* Adaptive speed toggle */}
          <div className="flex items-center justify-center">
            <button
              onClick={onToggleAdaptive}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                adaptive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {adaptive ? "Adaptive speed on" : "Adaptive speed"}
            </button>
          </div>
        </>
      )}

      {/* TTS toggle + provider info + settings */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onToggleTTS}
          className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full transition-colors ${
            ttsEnabled
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {ttsEnabled ? (
            <RiVolumeUpLine className="size-3.5" />
          ) : (
            <RiVolumeMuteLine className="size-3.5" />
          )}
          {ttsEnabled ? `Read aloud (${providerLabel})` : "Read aloud"}
        </button>

        {ttsEnabled && !ttsIsAzure && !ttsIsKokoro && ttsBrowserVoices.length > 0 && (
          <select
            value={ttsSelectedBrowserVoice?.name ?? ""}
            onChange={(e) => {
              const voice = ttsBrowserVoices.find((v) => v.name === e.target.value);
              if (voice) onSetBrowserVoice(voice);
            }}
            className="text-xs bg-muted/50 text-foreground border border-border rounded-full px-2 py-1 max-w-[160px] truncate outline-none focus:ring-1 focus:ring-ring"
          >
            {ttsBrowserVoices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        )}

        {ttsEnabled && ttsIsAzure && (
          <select
            value={ttsAzureVoiceName ?? ""}
            onChange={(e) => onSetVoice(e.target.value)}
            className="text-xs bg-muted/50 text-foreground border border-border rounded-full px-2 py-1 max-w-[160px] truncate outline-none focus:ring-1 focus:ring-ring"
          >
            {AZURE_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        )}

        {ttsEnabled && ttsIsKokoro && (
          <select
            value={ttsKokoroVoiceName ?? ""}
            onChange={(e) => onSetVoice(e.target.value)}
            className="text-xs bg-muted/50 text-foreground border border-border rounded-full px-2 py-1 max-w-[160px] truncate outline-none focus:ring-1 focus:ring-ring"
          >
            {KOKORO_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        )}

        {ttsEnabled && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onOpenSettings}
            title="TTS settings"
          >
            <RiSettings3Line className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
