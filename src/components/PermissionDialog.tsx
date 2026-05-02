import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShieldOff } from "lucide-react";
import Button from "@/components/ui/Button";

interface PermissionDialogProps {
  title?: string;
  description?: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export default function PermissionDialog({
  title = "Full Disk Access Required",
  description = "Aura needs Full Disk Access to scan your Trash and system directories. Please grant access in System Settings, then come back and try again.",
  onRetry,
  onDismiss,
}: PermissionDialogProps) {
  const [opening, setOpening] = useState(false);

  async function openSettings() {
    setOpening(true);
    try {
      await invoke("request_permission");
    } catch {
      // fallback — tell user to open manually
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-surface border border-border-default rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center">
            <ShieldOff size={20} className="text-warning" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-text-primary font-display">{title}</h2>
          </div>
        </div>

        <p className="text-[13px] text-text-secondary leading-relaxed mb-6">{description}</p>

        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={openSettings} loading={opening}>
            Open System Settings
          </Button>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
