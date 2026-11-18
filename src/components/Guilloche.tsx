import { memo } from 'react'

/** Small deterministic PRNG so every currency gets its own, stable pattern. */
function seeded(seed: string) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

interface Props {
  seed: string
  color: string
  size?: number
  className?: string
}

/**
 * Banknote-style guilloche rosette: concentric rings, each modulated by an
 * interfering sine, rotated a little per ring. Parameters derive from `seed`.
 */
export const Guilloche = memo(function Guilloche({ seed, color, size = 320, className }: Props) {
  const rnd = seeded(seed)
  const lobes = 6 + Math.floor(rnd() * 10) // petals
  const lobes2 = lobes * (2 + Math.floor(rnd() * 3)) + 1 // fine ripple
  const rings = 22
  const twist = 0.04 + rnd() * 0.12
  const amp = 0.06 + rnd() * 0.06
  const amp2 = 0.01 + rnd() * 0.02
  const c = size / 2
  const steps = 360
  const paths: string[] = []
  for (let k = 0; k < rings; k++) {
    const r0 = c * (0.18 + (0.78 * k) / rings)
    const ph = k * twist
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2
      const r = r0 * (1 + amp * Math.sin(lobes * t + ph * lobes) + amp2 * Math.sin(lobes2 * t - ph * 3))
      d += `${i ? 'L' : 'M'}${(c + r * Math.cos(t)).toFixed(1)},${(c + r * Math.sin(t)).toFixed(1)}`
    }
    paths.push(d + 'Z')
  }
  return (
    <svg className={className} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth={0.6}>
        {paths.map((d, i) => (
          <path key={i} d={d} strokeOpacity={0.25 + 0.75 * (i / rings)} />
        ))}
      </g>
    </svg>
  )
})

/** Wavy engraved band, like the security strip along a banknote's edge. */
export const GuillocheBand = memo(function GuillocheBand({ color, className }: { color: string; className?: string }) {
  const W = 1200
  const H = 60
  const lines = 14
  const paths: string[] = []
  for (let k = 0; k < lines; k++) {
    let d = ''
    for (let x = 0; x <= W; x += 6) {
      const y = H / 2 + Math.sin(x / 38 + k * 0.45) * (H * 0.32) * Math.cos(x / 210 - k * 0.08)
      d += `${x ? 'L' : 'M'}${x},${y.toFixed(1)}`
    }
    paths.push(d)
  }
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth={0.7} vectorEffect="non-scaling-stroke">
        {paths.map((d, i) => (
          <path key={i} d={d} vectorEffect="non-scaling-stroke" strokeOpacity={0.35 + (0.5 * i) / lines} />
        ))}
      </g>
    </svg>
  )
})
