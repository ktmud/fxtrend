/**
 * Categorical series colours (validated reference palette: adjacent-pair CVD ΔE ≥ 8,
 * normal-vision ΔE ≥ 15, in both modes). Slots are assigned in this fixed order and
 * stay with their currency – removing one never repaints the others.
 */
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767']
export const MAX_SERIES = SERIES_LIGHT.length

export const seriesVar = (slot: number) => `var(--series-${slot + 1})`
