import { useState } from "react";
import {
  RiCloseLine,
  RiVolumeUpLine,
} from "@remixicon/react";
import {
  type TTSProvider,
  type AzureConfig,
  type KokoroConfig,
  AZURE_VOICES,
  KOKORO_VOICES,
  getAzureConfig,
  getKokoroConfig,
  saveAzureConfig,
  saveKokoroConfig,
  getSelectedProvider,
  saveSelectedProvider,
} from "@/lib/tts-providers";
import { Button } from "@/components/ui/button";

interface TTSSettingsProps {
  open: boolean;
  onClose: () => void;
  onProviderChange: (
    provider: TTSProvider,
    azureConfig: AzureConfig | null,
    kokoroConfig: KokoroConfig | null,
  ) => void;
}

export function TTSSettings({ open, onClose, onProviderChange }: TTSSettingsProps) {
  const [provider, setProvider] = useState<TTSProvider>(getSelectedProvider);
  const [azureConfig, setAzureConfig] = useState<AzureConfig>(
    () => getAzureConfig() ?? { subscriptionKey: "", region: "eastus", voiceName: AZURE_VOICES[0].id }
  );
  const [kokoroConfig, setKokoroConfig] = useState<KokoroConfig>(
    () => getKokoroConfig() ?? { serverUrl: "http://localhost:8321", voiceName: KOKORO_VOICES[0].id }
  );
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const handleSave = () => {
    saveSelectedProvider(provider);
    if (provider === "azure") {
      saveAzureConfig(azureConfig);
      onProviderChange(provider, azureConfig, null);
    } else if (provider === "kokoro") {
      saveKokoroConfig(kokoroConfig);
      onProviderChange(provider, null, kokoroConfig);
    } else {
      onProviderChange(provider, null, null);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const providerBtn = (value: TTSProvider, label: string) => (
    <button
      onClick={() => setProvider(value)}
      className={`flex-1 text-sm px-3 py-2 rounded-lg border transition-colors ${
        provider === value
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <RiVolumeUpLine className="size-4 text-primary" />
            <h2 className="font-semibold text-sm">Text-to-Speech Settings</h2>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <RiCloseLine className="size-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Provider selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Provider
            </label>
            <div className="flex gap-2">
              {providerBtn("browser", "Browser")}
              {providerBtn("azure", "Azure")}
              {providerBtn("kokoro", "Kokoro")}
            </div>
          </div>

          {provider === "azure" && (
            <>
              {/* Subscription Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Subscription Key
                </label>
                <input
                  type="password"
                  value={azureConfig.subscriptionKey}
                  onChange={(e) =>
                    setAzureConfig((c) => ({ ...c, subscriptionKey: e.target.value }))
                  }
                  placeholder="Enter your Azure Speech key"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Region */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Region
                </label>
                <input
                  type="text"
                  value={azureConfig.region}
                  onChange={(e) =>
                    setAzureConfig((c) => ({ ...c, region: e.target.value }))
                  }
                  placeholder="e.g. eastus"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Voice */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Voice
                </label>
                <select
                  value={azureConfig.voiceName}
                  onChange={(e) =>
                    setAzureConfig((c) => ({ ...c, voiceName: e.target.value }))
                  }
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
                >
                  {AZURE_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-muted-foreground">
                Create a free Speech resource at{" "}
                <a
                  href="https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  portal.azure.com
                </a>
                {" "}&mdash; the F0 tier gives 500K chars/month free.
              </p>
            </>
          )}

          {provider === "kokoro" && (
            <>
              {/* Server URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Server URL
                </label>
                <input
                  type="text"
                  value={kokoroConfig.serverUrl}
                  onChange={(e) =>
                    setKokoroConfig((c) => ({ ...c, serverUrl: e.target.value }))
                  }
                  placeholder="http://localhost:8321"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Voice */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Voice
                </label>
                <select
                  value={kokoroConfig.voiceName}
                  onChange={(e) =>
                    setKokoroConfig((c) => ({ ...c, voiceName: e.target.value }))
                  }
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
                >
                  {KOKORO_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-muted-foreground">
                Run the local Kokoro server:{" "}
                <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                  python kokoro-server/server.py
                </code>
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            {saved ? "Saved!" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
