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
} from "@remixicon/react";
import { Button } from "@/components/ui/button";

interface ReaderControlsProps {
  // Playback state
  isPlaying: boolean;
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
  onOpenSettings: () => void;
}

export function ReaderControls({
  isPlaying,
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
  onOpenSettings,
}: ReaderControlsProps) {
  const providerLabel = ttsIsKokoro ? "Kokoro" : ttsIsAzure ? "Azure" : "Browser";

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
          {isPlaying ? <RiPauseFill className="size-5" /> : <RiPlayFill className="size-5" />}
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

        {ttsEnabled && !ttsIsAzure && ttsBrowserVoices.length > 0 && (
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

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onOpenSettings}
          title="TTS settings"
        >
          <RiSettings3Line className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
