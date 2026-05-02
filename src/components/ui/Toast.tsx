import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useAppStore } from "@/store";
import type { Toast } from "@/types";
import clsx from "clsx";

const TOAST_CONFIG = {
  success: { icon: CheckCircle, color: "#22C987", bg: "bg-success/10 border-success/30" },
  error:   { icon: AlertCircle, color: "#EF4444", bg: "bg-danger/10 border-danger/30" },
  warning: { icon: AlertTriangle, color: "#F59E0B", bg: "bg-warning/10 border-warning/30" },
  info:    { icon: Info, color: "#60A5FA", bg: "bg-info/10 border-info/30" },
} as const;

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useAppStore((s) => s.removeToast);
  const { icon: Icon, color, bg } = TOAST_CONFIG[toast.type];

  return (
    <div
      className={clsx(
        "flex items-start gap-3 w-80 p-3 rounded-xl border bg-bg-elevated backdrop-blur-sm",
        "animate-slide-right",
        bg
      )}
    >
      <Icon size={16} style={{ color }} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium text-text-primary">{toast.title}</p>
        {toast.description && (
          <p className="text-[11.5px] text-text-secondary mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 text-text-muted hover:text-text-secondary transition-colors p-0.5 rounded"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
