import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: unknown };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("UI ErrorBoundary caught:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full border border-border rounded-xl p-6 bg-card">
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-4">
            The page crashed. Try reloading or go back to the Dashboard.
          </p>
          <div className="flex gap-2">
            <button onClick={() => location.reload()} className="px-3 py-2 rounded-md bg-primary text-primary-foreground">
              Reload
            </button>
            <a href="/#/dashboard" className="px-3 py-2 rounded-md border border-border">
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
