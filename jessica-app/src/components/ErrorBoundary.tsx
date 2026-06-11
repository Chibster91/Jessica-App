import { Component, type ErrorInfo, type ReactNode } from "react";
import { appendDebugLog } from "../appSupport";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    appendDebugLog("react-render-error", {
      message: error.message,
      stack: error.stack ?? null,
      componentStack: errorInfo.componentStack ?? null,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
