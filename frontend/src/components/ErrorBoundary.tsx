import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional custom fallback — replaces the default error card. */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Catches unhandled render errors in any child subtree.
 * Displays a recovery UI; clicking "Try Again" resets the boundary.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Custom fallback</p>}>
 *     <RiskyWidget />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console (and any future error-reporting service)
    console.error('[ErrorBoundary] Unhandled render error:', error, info.componentStack)
  }

  private reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    const msg =
      this.state.error?.message?.slice(0, 120) ||
      'An unexpected error occurred in this section.'

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 p-8">
        {/* Icon */}
        <div className="w-20 h-20 border-2 border-danger bg-danger/10 flex items-center justify-center brutal-shadow">
          <AlertTriangle className="w-9 h-9 text-danger" />
        </div>

        {/* Copy */}
        <div className="text-center space-y-2 max-w-md">
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            Something Went Wrong
          </h2>
          <p className="font-mono text-xs text-ink-light leading-relaxed">{msg}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={this.reset}
            className="flex items-center gap-2 px-5 py-3 bg-ink text-surface font-mono text-sm uppercase tracking-wider border-2 border-ink brutal-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all outline-none brutal-focus"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <a
            href="/"
            className="flex items-center justify-center gap-2 px-5 py-3 bg-paper text-ink font-mono text-sm uppercase tracking-wider border-2 border-ink brutal-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all outline-none brutal-focus"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </a>
        </div>
      </div>
    )
  }
}
