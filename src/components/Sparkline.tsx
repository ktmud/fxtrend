interface Props {
  values: (number | null)[]
  color: string
}

const W = 100
const H = 32

/** Fluid sparkline: stretches to its container, stroke width stays constant. */
export function Sparkline({ values, color }: Props) {
  let lo = Infinity
  let hi = -Infinity
  for (const v of values)
    if (v != null) {
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
  if (!Number.isFinite(lo)) return null
  const span = hi - lo || 1
  const n = values.length
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v == null) {
      pen = false
      return
    }
    const x = (i / Math.max(1, n - 1)) * W
    const y = 2 + (1 - (v - lo) / span) * (H - 4)
    d += `${pen ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`
    pen = true
  })
  return (
    <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} stroke={color} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
