import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Copy } from 'lucide-react';
import { cn } from '../lib/utils';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 'fullscreen' centers on the whole viewport; 'page' fills the routed content area. */
  variant?: 'page' | 'fullscreen';
  title?: string;
  description?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Diagnostics only. Avoid surfacing raw messages to users in production
    // because some thrown errors embed PII (see lib/firestore-errors.ts).
    // TODO(M7): forward to a structured logging/error-reporting sink here.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyDetails = () => {
    const { error } = this.state;
    if (!error) return;
    const details = `${error.name}: ${error.message}\n\n${error.stack ?? ''}`;
    void navigator.clipboard?.writeText(details);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { variant = 'page', title, description } = this.props;
    const { error } = this.state;
    const isFullscreen = variant === 'fullscreen';

    return (
      <div
        className={cn(
          'flex items-center justify-center p-6',
          isFullscreen ? 'min-h-screen bg-zinc-50' : 'w-full min-h-[60vh]'
        )}
      >
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>

          <h1 className="text-lg font-bold text-zinc-900">
            {title ?? 'Something went wrong'}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {description ??
              'An unexpected error occurred while displaying this page. You can try again, or reload the app.'}
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <RotateCcw className="w-4 h-4" />
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 text-zinc-700 text-sm font-medium hover:bg-zinc-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload page
            </button>
          </div>

          <button
            onClick={this.handleCopyDetails}
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy error details
          </button>

          {import.meta.env.DEV && error && (
            <details className="mt-5 text-left">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-500">
                Technical details (dev only)
              </summary>
              <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-zinc-900 text-zinc-100 text-[11px] leading-relaxed p-3 whitespace-pre-wrap break-words">
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ''}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
