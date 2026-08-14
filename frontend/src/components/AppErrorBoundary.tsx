import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

// Keep a startup crash visible instead of leaving the browser on a blank page.
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Application startup failed", error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
          <section className="w-full max-w-xl rounded-xl border border-red-400/40 bg-slate-900 p-6 shadow-2xl">
            <h1 className="text-xl font-semibold text-red-300">Frontend could not start</h1>
            <p className="mt-3 text-sm text-slate-300">Refresh after checking the development terminal. The error is also available in the browser console.</p>
            <pre className="mt-4 overflow-auto rounded bg-black/40 p-3 text-sm text-red-200">{this.state.error.message}</pre>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
