import { X, Minus, Square } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "@/store";

export default function TitleBar() {
  const platform = useAppStore((s) => s.platform);
  if (platform === "macos") return null;

  const win = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-[52px] px-4 bg-bg-surface border-b border-border-subtle shrink-0"
    >
      <div className="flex items-center gap-2">
        <span className="font-display font-700 text-[13px] text-text-primary">Aura</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => win.minimize()}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-elevated"
          aria-label="Minimize"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => win.toggleMaximize()}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-elevated"
          aria-label="Maximize"
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => win.close()}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-danger hover:bg-danger/10"
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
