import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useAppStore } from "@/store";
import Select from "@/components/ui/Select";

export default function Settings() {
  const { settings, updateSettings } = useAppStore();
  const [newExcluded, setNewExcluded] = useState("");

  function addExcluded() {
    const trimmed = newExcluded.trim();
    if (trimmed && !settings.excludedPaths.includes(trimmed)) {
      updateSettings({ excludedPaths: [...settings.excludedPaths, trimmed] });
      setNewExcluded("");
    }
  }

  function removeExcluded(path: string) {
    updateSettings({ excludedPaths: settings.excludedPaths.filter((p) => p !== path) });
  }

  return (
    <div className="p-6 max-w-lg overflow-y-auto h-full">
      <h2 className="font-display font-semibold text-[17px] text-text-primary mb-6">Settings</h2>
      <div className="space-y-4">
        {/* Appearance */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">Appearance</div>
          <label className="flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-medium text-text-primary">Theme</div>
              <div className="text-[11px] text-text-muted">Dark or light appearance</div>
            </div>
            <Select
              value={settings.theme}
              onChange={(v) => updateSettings({ theme: v as "dark" | "light" })}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
            />
          </label>
        </div>

        {/* Cleanup */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">Cleanup</div>
          <label className="flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-medium text-text-primary">Delete Mode</div>
              <div className="text-[11px] text-text-muted">How items are removed</div>
            </div>
            <Select
              value={settings.deleteMode}
              onChange={(v) => updateSettings({ deleteMode: v as "trash" | "permanent" })}
              options={[
                { value: "trash", label: "Move to Trash" },
                { value: "permanent", label: "Delete Permanently" },
              ]}
            />
          </label>
        </div>

        {/* Scan */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 space-y-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">Scan</div>

          <label className="flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-medium text-text-primary">Scan on Startup</div>
              <div className="text-[11px] text-text-muted">Run SmartScan when Aura launches</div>
            </div>
            <input
              type="checkbox"
              checked={settings.scanOnStartup}
              onChange={(e) => updateSettings({ scanOnStartup: e.target.checked })}
              className="w-4 h-4 accent-[#00D4AA]"
            />
          </label>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[12.5px] font-medium text-text-primary">Large File Threshold</div>
              <span className="text-[11px] font-mono text-text-secondary">{settings.largeFileSizeThresholdMb} MB</span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={settings.largeFileSizeThresholdMb}
              onChange={(e) => updateSettings({ largeFileSizeThresholdMb: Number(e.target.value) })}
              className="w-full accent-[#00D4AA]"
            />
            <div className="text-[11px] text-text-muted mt-0.5">Minimum file size to flag as large</div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[12.5px] font-medium text-text-primary">File Age Threshold</div>
              <span className="text-[11px] font-mono text-text-secondary">{settings.largeFileAgeThresholdDays} days</span>
            </div>
            <input
              type="range"
              min={30}
              max={1095}
              step={30}
              value={settings.largeFileAgeThresholdDays}
              onChange={(e) => updateSettings({ largeFileAgeThresholdDays: Number(e.target.value) })}
              className="w-full accent-[#00D4AA]"
            />
            <div className="text-[11px] text-text-muted mt-0.5">Files not accessed in this many days</div>
          </div>

          <label className="flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-medium text-text-primary">Show Hidden Files</div>
              <div className="text-[11px] text-text-muted">Include dotfiles in scans</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showHiddenFiles}
              onChange={(e) => updateSettings({ showHiddenFiles: e.target.checked })}
              className="w-4 h-4 accent-[#00D4AA]"
            />
          </label>

          <div>
            <div className="text-[12.5px] font-medium text-text-primary mb-2">Excluded Paths</div>
            <div className="space-y-1.5 mb-2">
              {settings.excludedPaths.map((path) => (
                <div key={path} className="flex items-center gap-2 bg-bg-overlay rounded-md px-2 py-1.5">
                  <span className="flex-1 text-[11px] font-mono text-text-secondary truncate">{path}</span>
                  <button onClick={() => removeExcluded(path)} className="text-text-muted hover:text-danger transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newExcluded}
                onChange={(e) => setNewExcluded(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExcluded()}
                placeholder="/path/to/exclude"
                className="flex-1 bg-bg-overlay border border-border-default text-text-primary text-[12px] rounded-md px-2 py-1.5 placeholder:text-text-muted"
              />
              <button
                onClick={addExcluded}
                className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-hover transition-colors"
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-text-muted font-mono mt-6">Aura v0.1.0 · Built with Rust + Tauri</p>
    </div>
  );
}
