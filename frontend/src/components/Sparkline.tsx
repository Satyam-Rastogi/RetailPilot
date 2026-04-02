interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  filled?: boolean
}

export function Sparkline({ data, width = 80, height = 28, color = 'var(--theme-accent)', filled = false }: SparklineProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padX = 2, padY = 2
  const innerW = width - padX * 2
  const innerH = height - padY * 2

  const points = data.map((v, i) => [
    padX + (i / (data.length - 1)) * innerW,
    padY + (1 - (v - min) / range) * innerH,
  ] as [number, number])

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')
  const fillPath = `${linePath} L ${points[points.length - 1][0].toFixed(2)} ${(height - padY).toFixed(2)} L ${points[0][0].toFixed(2)} ${(height - padY).toFixed(2)} Z`

  const trend = data[data.length - 1] >= data[0]
  const trendColor = trend ? 'var(--theme-success)' : 'var(--theme-danger)'
  const lineColor = color === 'var(--theme-accent)' ? trendColor : color

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible shrink-0" aria-hidden="true">
      {filled && <path d={fillPath} fill={lineColor} fillOpacity={0.12} />}
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.5} fill={lineColor} />
    </svg>
  )
}
