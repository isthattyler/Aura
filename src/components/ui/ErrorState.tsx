import { AlertTriangle, RotateCcw } from "lucide-react";
import Button from "@/components/ui/Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-4">
        <AlertTriangle size={22} className="text-danger" />
      </div>
      <h3 className="text-[14px] font-medium text-text-primary mb-1">{title}</h3>
      <p className="text-[12px] text-text-muted max-w-xs mb-4">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RotateCcw size={14} className="mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
