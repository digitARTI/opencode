/**
 * WCAG contrast audit for the built-in theme tokens.
 *
 * Run from the repository root: `bun script/contrast-audit.ts`
 *
 * Reports the contrast ratio of the theme's text/icon tokens against the surfaces they sit on.
 * Required text pairs must reach 4.5:1 (WCAG 1.4.3); large/decorative tokens use 3:1 (1.4.11).
 * The "faint" tokens are reported for visibility but are intentionally subtle, so they are
 * informational rather than a hard failure.
 */
import oc2 from "../packages/ui/src/theme/themes/oc-2.json"

type Variant = Record<string, string | undefined>

const parseHex = (value: string): [number, number, number] => {
  const hex = value.replace("#", "").slice(0, 6)

  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
}

const luminance = ([r, g, b]: [number, number, number]) => {
  const channel = (c: number) => {
    const v = c / 255

    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const contrast = (a: string, b: string) => {
  const la = luminance(parseHex(a))
  const lb = luminance(parseHex(b))
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)

  return (hi + 0.05) / (lo + 0.05)
}

// Resolves `var(--token)` chains to a hex color, the way the theme does at runtime.
const resolve = (variant: Variant, value: string | undefined, depth = 0): string | undefined => {
  if (!value || depth > 8) return undefined
  if (value.startsWith("var(--")) return resolve(variant, variant[value.slice(6, -1)], depth + 1)
  if (value.startsWith("#")) return value

  return undefined
}

type Pair = { label: string; fg: string; bg: string }

const pairs: Pair[] = [
  { label: "text-base on bg-base", fg: "v2-text-text-base", bg: "v2-background-bg-base" },
  { label: "text-muted on bg-base", fg: "v2-text-text-muted", bg: "v2-background-bg-base" },
  { label: "text-base on layer-01", fg: "v2-text-text-base", bg: "v2-background-bg-layer-01" },
  { label: "text-muted on layer-02", fg: "v2-text-text-muted", bg: "v2-background-bg-layer-02" },
  { label: "text-faint on bg-base (subtle metadata)", fg: "v2-text-text-faint", bg: "v2-background-bg-base" },
  { label: "icon-base on bg-base", fg: "v2-icon-icon-base", bg: "v2-background-bg-base" },
  { label: "icon-faint on bg-base (decorative)", fg: "v2-icon-icon-faint", bg: "v2-background-bg-base" },
]

const REQUIRED = 4.5
const LARGE = 3
const informational = (label: string) => label.includes("subtle") || label.includes("decorative")

let failures = 0

for (const mode of ["light", "dark"] as const) {
  const variant = { ...oc2[mode].palette, ...oc2[mode].overrides, ...oc2[mode].v2Overrides } as Variant
  console.log(`\n${mode}:`)

  for (const pair of pairs) {
    const fg = resolve(variant, variant[pair.fg])
    const bg = resolve(variant, variant[pair.bg])

    if (!fg || !bg) {
      console.log(`  ? ${pair.label}: unresolved`)

      continue
    }

    const ratio = contrast(fg, bg)
    const verdict = ratio >= REQUIRED ? "AA" : ratio >= LARGE ? "large-only" : "fail"
    const note = informational(pair.label) ? " (informational)" : ""

    if (verdict !== "AA" && !informational(pair.label)) failures++
    console.log(`  ${ratio.toFixed(2)}:1 ${verdict} — ${pair.label}${note}`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} required pair(s) below ${REQUIRED}:1`)
  process.exit(1)
}

console.log("\nAll required text pairs meet WCAG AA.")
