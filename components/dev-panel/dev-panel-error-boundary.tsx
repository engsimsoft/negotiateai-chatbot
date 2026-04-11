"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportClientError } from "@/lib/client/error-bus";

/**
 * ТЗ-DevPanelErrors: React Error Boundary that publishes caught render errors
 * to the client error bus → picked up by DevPanelProvider → visible in DevPanel.
 *
 * Provides a minimal fallback UI when children crash. Gated on dev mode at the
 * UI level — in production you'd want a proper fallback.
 *
 * Placement: wrap the Chat subtree in chat.tsx so render/hook crashes in chat
 * components surface in DevPanel instead of just the browser console.
 */

interface Props {
  children: ReactNode;
  /** Optional override for fallback UI. Defaults to a compact error card. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

const IS_DEV_MODE = process.env.NEXT_PUBLIC_SIMPLY_DEV_MODE === "true";

export class DevPanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Always log to console for production visibility.
    console.error("[DevPanelErrorBoundary] Render crash:", error, info);

    // Only report to DevPanel bus when dev mode is on — otherwise the
    // subscriber (DevPanelProvider) would no-op anyway.
    if (IS_DEV_MODE) {
      reportClientError({
        source: "client:error-boundary",
        message: error.message,
        stack: error.stack?.slice(0, 2000),
        context: {
          componentStack: info.componentStack?.slice(0, 1000) ?? undefined,
        },
      });
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, message: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div className="m-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <div className="font-mono font-medium text-destructive">
          Render error caught
        </div>
        <div className="mt-1 text-muted-foreground">
          {this.state.message ?? "Unknown error"}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Подробности — в DevPanel (секция Errors) и в browser console.
        </div>
        <button
          type="button"
          onClick={this.reset}
          className="mt-3 rounded border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
        >
          Попробовать ещё раз
        </button>
      </div>
    );
  }
}
