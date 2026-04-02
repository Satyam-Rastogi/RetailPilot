import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  width?: string
  height?: string
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return <div className={cn('animate-pulse bg-line', className)} style={{ width, height }} />
}

export function SkeletonCard() {
  return (
    <div className="p-5 brutal-border bg-surface space-y-4">
      <div className="flex justify-between items-start">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-5 w-12" />
      </div>
      <Skeleton className="h-8 w-36 mt-2" />
      <Skeleton className="h-10 w-full mt-2" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-line">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-32 flex-1" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}
