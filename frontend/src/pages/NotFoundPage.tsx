import { useNavigate, useLocation } from 'react-router-dom'
import { Home, ArrowLeft, Search } from 'lucide-react'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 p-8">
      {/* Code block */}
      <div className="font-mono text-[6rem] md:text-[8rem] font-bold leading-none select-none tabular-nums text-ink/10 tracking-tight">
        404
      </div>

      {/* Icon badge */}
      <div className="w-20 h-20 border-2 border-accent bg-accent/10 flex items-center justify-center brutal-shadow -mt-6">
        <Search className="w-9 h-9 text-accent" />
      </div>

      {/* Copy */}
      <div className="text-center space-y-3 max-w-md">
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight">
          Page Not Found
        </h1>
        <p className="font-mono text-sm text-ink-light leading-relaxed">
          The page at{' '}
          <code className="bg-surface border border-line px-1.5 py-0.5 text-xs">
            {location.pathname}
          </code>{' '}
          does not exist or has been moved.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-paper text-ink font-mono text-sm uppercase tracking-wider border-2 border-ink brutal-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all outline-none brutal-focus"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-ink text-surface font-mono text-sm uppercase tracking-wider border-2 border-ink brutal-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all outline-none brutal-focus"
        >
          <Home className="w-4 h-4" />
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
