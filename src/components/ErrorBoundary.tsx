import { Component, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; message?: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Unknown error" };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error);
  }

  reset = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] w-full flex items-center justify-center p-6 bg-background">
          <div className="max-w-sm text-center space-y-3">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.message}
            </p>
            <button
              onClick={() => { this.reset(); window.location.reload(); }}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}