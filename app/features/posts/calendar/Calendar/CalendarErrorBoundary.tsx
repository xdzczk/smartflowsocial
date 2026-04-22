/**
 * Error boundary for the calendar view area. Isolates failures in Day/Week/Month
 * so the header and modals remain usable. "Try again" resets and re-renders children.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface CalendarErrorBoundaryProps {
  children: ReactNode;
}

interface CalendarErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class CalendarErrorBoundary extends Component<
  CalendarErrorBoundaryProps,
  CalendarErrorBoundaryState
> {
  constructor(props: CalendarErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): CalendarErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (typeof window !== "undefined") {
      console.error("Calendar view error:", error, errorInfo.componentStack);
    }
  }

  handleTryAgain = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-[hsl(var(--calendar-surface-2-bg))] p-6"
          role="alert"
        >
          <p className="text-text-secondary text-center text-sm">
            Something went wrong loading the calendar view.
          </p>
          <button
            type="button"
            onClick={this.handleTryAgain}
            className="bg-brand text-brand-on hover:bg-brand/90 motion-fast rounded-[var(--calendar-radius-md)] px-4 py-2 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
