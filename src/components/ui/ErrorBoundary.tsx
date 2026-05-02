import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-danger/15 flex items-center justify-center">
            <AlertTriangle size={24} className="text-danger" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary font-display mb-1">
              Something went wrong
            </h3>
            <p className="text-[12px] text-text-muted max-w-xs leading-relaxed">
              {this.state.error.message}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => this.setState({ error: null })}
          >
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
