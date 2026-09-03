import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  /** Optional label so logs say which boundary caught it (e.g. "route", "app"). */
  scope?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Detects the "a new version was deployed and this chunk no longer exists"
 * class of error — worth a hard reload rather than a generic message. */
function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /loading chunk|loading css chunk|dynamically imported module|failed to fetch dynamically/i.test(
    msg,
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Always visible in the console for whoever is debugging.
    console.error(`[ErrorBoundary${this.props.scope ? `:${this.props.scope}` : ""}]`, error, info);
    // Best-effort telemetry — GA4 'exception' event. Never throws, no-ops
    // without GA. This is the only crash signal the operator gets.
    try {
      window.gtag?.("event", "exception", {
        description: `${this.props.scope ?? "app"}: ${error?.name}: ${error?.message}`.slice(0, 300),
        fatal: true,
      });
    } catch {
      /* ignore */
    }
    // A stale-chunk error after a deploy: reload once to pull the new bundle.
    if (isChunkLoadError(error)) {
      try {
        if (!sessionStorage.getItem("chunk-reload")) {
          sessionStorage.setItem("chunk-reload", "1");
          window.location.reload();
        }
      } catch {
        /* ignore */
      }
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
