import { useState, useEffect, useCallback, useRef } from "react";
import { useRSVP } from "@/hooks/useRSVP";
import { useTTSEngine } from "@/hooks/useTTSEngine";
import { usePdfDocument } from "@/hooks/usePdfDocument";
import { useEpubDocument } from "@/hooks/useEpubDocument";
import { updateDocument, type StoredDocument } from "@/lib/storage";
import { ReaderHeader } from "./ReaderHeader";
import { ReaderControls } from "./ReaderControls";
import { WordDisplay } from "./WordDisplay";
import { TextPane } from "./TextPane";
import { PdfPane } from "./PdfPane";
import { EpubPane } from "./EpubPane";
import { TTSSettings } from "./TTSSettings";

interface ReaderPageProps {
  document: StoredDocument;
  onBack: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

type ViewMode = "text" | "pdf" | "epub";

export function ReaderPage({ document: doc, onBack, dark, onToggleDark }: ReaderPageProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(
    doc.hasPdfData ? "pdf" : doc.hasEpubData ? "epub" : "text"
  );
  const [fontScale, setFontScale] = useState(100);
  const [textFontScale, setTextFontScale] = useState(100);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [epubZoom, setEpubZoom] = useState(100);
  const { pdfDoc, pdfData } = usePdfDocument(doc.hasPdfData ? doc.id : null);
  const { epubData, imageUrls } = useEpubDocument(doc.hasEpubData ? doc.id : null);

  const handleProgress = useCallback(
    (index: number, wpm: number) => {
      updateDocument(doc.id, { currentWordIndex: index, wpm });
    },
    [doc.id]
  );

  const rsvp = useRSVP({
    text: doc.text,
    initialIndex: doc.currentWordIndex,
    initialWpm: doc.wpm,
    onProgress: handleProgress,
  });

  const tts = useTTSEngine({
    onWordBoundary: rsvp.seekTo,
    onEnd: () => {},
  });

  const isPlaying = tts.enabled ? tts.speaking : rsvp.playing;
  const progressPercent = Math.round(rsvp.progress * 100);

  // Unified play/pause
  const handleTogglePlay = useCallback(() => {
    if (tts.enabled) {
      if (tts.speaking) {
        tts.stop();
      } else {
        tts.speak(rsvp.words, rsvp.currentIndex);
      }
    } else {
      rsvp.togglePlay();
    }
  }, [tts, rsvp]);

  const handleSeek = useCallback(
    (index: number) => {
      rsvp.seekTo(index);
      if (tts.enabled && tts.speaking) {
        tts.speak(rsvp.words, index);
      }
    },
    [rsvp, tts]
  );

  const handleSkipSentenceBack = useCallback(() => {
    const newIdx = rsvp.skipSentenceBack();
    if (tts.enabled && tts.speaking) {
      tts.speak(rsvp.words, newIdx);
    }
  }, [rsvp, tts]);

  const handleSkipSentenceForward = useCallback(() => {
    const newIdx = rsvp.skipSentenceForward();
    if (tts.enabled && tts.speaking) {
      tts.speak(rsvp.words, newIdx);
    }
  }, [rsvp, tts]);

  const handleSkipParaBack = useCallback(() => {
    const newIdx = rsvp.skipParaBack();
    if (tts.enabled && tts.speaking) {
      tts.speak(rsvp.words, newIdx);
    }
  }, [rsvp, tts]);

  const handleSkipParaForward = useCallback(() => {
    const newIdx = rsvp.skipParaForward();
    if (tts.enabled && tts.speaking) {
      tts.speak(rsvp.words, newIdx);
    }
  }, [rsvp, tts]);

  const handleToggleTTS = useCallback(() => {
    if (tts.enabled && tts.speaking) {
      tts.stop();
    }
    if (!tts.enabled && rsvp.playing) {
      rsvp.stop();
    }
    tts.toggleEnabled();
  }, [tts, rsvp]);

  // Keep refs for unmount save
  const currentIndexRef = useRef(rsvp.currentIndex);
  currentIndexRef.current = rsvp.currentIndex;
  const wpmRef = useRef(rsvp.wpm);
  wpmRef.current = rsvp.wpm;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          handleTogglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSkipSentenceBack();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSkipSentenceForward();
          break;
        case "Equal":
        case "NumpadAdd":
          e.preventDefault();
          if (tts.enabled) {
            tts.setRate((r) => Math.min(2, +(r + 0.1).toFixed(1)));
          } else {
            rsvp.adjustWpm(10);
          }
          break;
        case "Minus":
        case "NumpadSubtract":
          e.preventDefault();
          if (tts.enabled) {
            tts.setRate((r) => Math.max(0.5, +(r - 0.1).toFixed(1)));
          } else {
            rsvp.adjustWpm(-10);
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleTogglePlay, handleSkipSentenceBack, handleSkipSentenceForward, rsvp, tts]);

  // Save on unmount
  useEffect(() => {
    return () => {
      updateDocument(doc.id, {
        currentWordIndex: currentIndexRef.current,
        wpm: wpmRef.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <ReaderHeader
        filename={doc.filename}
        progressPercent={progressPercent}
        dark={dark}
        onBack={onBack}
        onToggleDark={onToggleDark}
      />

      {/* Main content - split pane */}
      <div className="flex-1 flex min-h-0">
        {/* Left pane - Word display */}
        <div className="flex-1 flex flex-col border-r border-border">
          <div className="flex-1 min-h-0 relative">
            <div className="absolute top-3 right-3 z-10 flex items-center rounded-full bg-muted/60 backdrop-blur-sm ring-1 ring-border">
              <button
                onClick={() => setFontScale((s) => Math.max(50, s - 10))}
                className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                -
              </button>
              <span className="px-1.5 py-1 text-xs font-medium text-foreground tabular-nums min-w-[3ch] text-center">
                {fontScale}%
              </span>
              <button
                onClick={() => setFontScale((s) => Math.min(200, s + 10))}
                className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
            <WordDisplay word={rsvp.currentWord} fontScale={fontScale} />
          </div>

          <ReaderControls
            isPlaying={isPlaying}
            currentIndex={rsvp.currentIndex}
            totalWords={rsvp.totalWords}
            wpm={rsvp.wpm}
            effectiveWpm={rsvp.effectiveWpm}
            adaptive={rsvp.adaptive}
            ttsEnabled={tts.enabled}
            ttsRate={tts.rate}
            ttsIsAzure={tts.isAzure}
            ttsIsKokoro={tts.isKokoro}
            ttsBrowserVoices={tts.browserVoices}
            ttsSelectedBrowserVoice={tts.selectedBrowserVoice}
            onTogglePlay={handleTogglePlay}
            onSeek={handleSeek}
            onSkipSentenceBack={handleSkipSentenceBack}
            onSkipSentenceForward={handleSkipSentenceForward}
            onSkipParaBack={handleSkipParaBack}
            onSkipParaForward={handleSkipParaForward}
            onAdjustWpm={rsvp.adjustWpm}
            onSetWpm={rsvp.setWpm}
            onToggleAdaptive={rsvp.toggleAdaptive}
            onSetTTSRate={tts.setRate}
            onToggleTTS={handleToggleTTS}
            onSetBrowserVoice={tts.setSelectedBrowserVoice}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>

        {/* Right pane - Text or PDF view */}
        <div className="flex-1 min-h-0 flex flex-col">
          {(doc.hasPdfData || doc.hasEpubData) && (
            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => setViewMode("text")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === "text"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Text
              </button>
              {doc.hasPdfData && (
                <button
                  onClick={() => setViewMode("pdf")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === "pdf"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  PDF
                </button>
              )}
              {doc.hasEpubData && (
                <button
                  onClick={() => setViewMode("epub")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === "epub"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ePub
                </button>
              )}
            </div>
          )}
          <div className="flex-1 min-h-0 relative">
            <div className="absolute top-3 right-3 z-10 flex items-center rounded-full bg-muted/60 backdrop-blur-sm ring-1 ring-border">
              <button
                onClick={() => {
                  if (viewMode === "pdf") setPdfZoom((s) => Math.max(50, s - 10));
                  else if (viewMode === "epub") setEpubZoom((s) => Math.max(50, s - 10));
                  else setTextFontScale((s) => Math.max(50, s - 10));
                }}
                className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                -
              </button>
              <span className="px-1.5 py-1 text-xs font-medium text-foreground tabular-nums min-w-[3ch] text-center">
                {viewMode === "pdf" ? pdfZoom : viewMode === "epub" ? epubZoom : textFontScale}%
              </span>
              <button
                disabled={viewMode === "pdf" && pdfZoom >= 100}
                onClick={() => {
                  if (viewMode === "pdf") setPdfZoom((s) => Math.min(100, s + 10));
                  else if (viewMode === "epub") setEpubZoom((s) => Math.min(200, s + 10));
                  else setTextFontScale((s) => Math.min(200, s + 10));
                }}
                className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
            {viewMode === "pdf" && pdfDoc && pdfData ? (
              <PdfPane
                pdfDoc={pdfDoc}
                pdfData={pdfData}
                currentWordIndex={rsvp.currentIndex}
                currentWord={rsvp.currentWord}
                onWordClick={handleSeek}
                zoomLevel={pdfZoom}
              />
            ) : viewMode === "epub" && epubData ? (
              <EpubPane
                epubData={epubData}
                imageUrls={imageUrls}
                currentWordIndex={rsvp.currentIndex}
                currentWord={rsvp.currentWord}
                onWordClick={handleSeek}
                zoomLevel={epubZoom}
              />
            ) : (
              <TextPane
                words={rsvp.words}
                currentIndex={rsvp.currentIndex}
                onWordClick={handleSeek}
                fontScale={textFontScale}
              />
            )}
          </div>
        </div>
      </div>

      {/* TTS Settings modal */}
      <TTSSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onProviderChange={tts.updateProvider}
      />
    </div>
  );
}
