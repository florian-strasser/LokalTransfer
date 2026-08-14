// Derive a full 50–950 colour ramp from a single hex value.
//
// Nuxt UI expects an eleven-step scale per colour (`--ui-color-primary-50` …
// `-950`) and resolves `--ui-primary` to step 500 in light mode and step 400 in
// dark mode. The instance is configured with just one hex per mode, so the rest
// of the ramp is generated here instead of being hand-picked.
//
// The work happens in OKLCH: hue and chroma come from the configured colour and
// only lightness is stepped, which keeps every shade recognisably the same
// colour (stepping in sRGB muddies the light end and blackens the dark end).
// Output is emitted as `oklch()` directly — Tailwind 4 already requires a
// browser that understands it, so there is no reason to round-trip back to hex
// and lose gamut precision.

// Lightness targets lifted from Tailwind 4's own ramps. These have to match:
// Nuxt UI hard-codes which shade fills which role (`--ui-bg` in dark mode is
// neutral-900, borders are neutral-200, and so on), so a ramp that is lighter or
// darker than Tailwind's at a given step quietly breaks its contrast choices.
const LIGHTNESS = [0.985, 0.97, 0.922, 0.87, 0.708, 0.556, 0.439, 0.371, 0.269, 0.205, 0.145]

// Chroma per step, relative to the chroma at shade 500. Saturation peaks around
// 600 and tapers toward both ends, which is how Tailwind's own colours behave as
// they approach white and black.
const CHROMA_FACTOR = [0.086, 0.164, 0.309, 0.490, 0.736, 1.0, 1.122, 1.079, 0.912, 0.715, 0.493]

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

export interface Oklch { l: number, c: number, h: number }

/** Parse `#rgb`, `#rrggbb` (with or without the hash) into 0–1 sRGB channels. */
function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, '')
  const expanded = raw.length === 3
    ? raw.split('').map(ch => ch + ch).join('')
    : raw

  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null

  return [
    parseInt(expanded.slice(0, 2), 16) / 255,
    parseInt(expanded.slice(2, 4), 16) / 255,
    parseInt(expanded.slice(4, 6), 16) / 255
  ]
}

/** Undo the sRGB transfer function to get light-linear values. */
function toLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

/** sRGB hex → OKLCH. Returns null when the hex can't be parsed. */
export function hexToOklch(hex: string): Oklch | null {
  const rgb = parseHex(hex)
  if (!rgb) return null

  const [r, g, b] = rgb.map(toLinear) as [number, number, number]

  // Linear sRGB → LMS, then the cube root that gives OKLab its perceptual
  // uniformity (Björn Ottosson's matrices).
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const labL = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const labA = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s

  const chroma = Math.sqrt(labA * labA + labB * labB)
  // atan2 returns −180…180; CSS wants 0…360.
  const hue = ((Math.atan2(labB, labA) * 180) / Math.PI + 360) % 360

  return { l: labL, c: chroma, h: hue }
}

function format({ l, c, h }: Oklch): string {
  return `oklch(${(l * 100).toFixed(2)}% ${c.toFixed(4)} ${h.toFixed(2)})`
}

export interface ScaleOptions {
  /**
   * Which step the supplied hex should land on verbatim. Light mode resolves
   * `--ui-primary` to 500 and dark mode to 400, so anchoring per mode means the
   * exact configured colour is what actually shows up on a button.
   */
  anchor?: 400 | 500
  /**
   * Upper bound on chroma. The neutral ramp passes a near-zero value so a
   * mis-configured neutral hex can't smuggle a second colour into a design that
   * is meant to be greyscale plus one accent.
   */
  maxChroma?: number
}

/**
 * Build the eleven-step ramp for one colour.
 *
 * Falls back to `fallbackHex` when `hex` is unparseable, so a typo in an env
 * variable degrades to the default theme instead of rendering an invalid
 * stylesheet (which would strip every colour from the page).
 */
export function buildColorScale(
  hex: string,
  fallbackHex: string,
  options: ScaleOptions = {}
): Record<number, string> {
  const { anchor = 500, maxChroma } = options

  const base = hexToOklch(hex) || hexToOklch(fallbackHex)
  // Both unparseable would mean a broken default; treat it as mid grey.
  const source = base || { l: 0.55, c: 0, h: 0 }

  const anchorIndex = STEPS.indexOf(anchor as typeof STEPS[number])
  const chromaCap = maxChroma ?? Number.POSITIVE_INFINITY
  // Scale the ramp so the anchor step reproduces the configured chroma exactly.
  const peakChroma = Math.min(source.c, chromaCap) / CHROMA_FACTOR[anchorIndex]!

  const anchorL = source.l
  const targetAnchorL = LIGHTNESS[anchorIndex]!
  // A configured colour is rarely exactly as light as the Tailwind step it has
  // to land on (#0066CC sits at 52% where step 500 expects 62%). Pinning just
  // that one step and leaving the others at their targets would break the
  // ordering — 500 would come out darker than 600. So the ramp is stretched
  // around the anchor instead: the two halves are rescaled to meet at the
  // configured lightness while still reaching the light and dark ends. That
  // keeps the ramp monotonic whatever hex is configured.
  const lightEnd = Math.max(LIGHTNESS[0]!, anchorL)
  const darkEnd = Math.min(LIGHTNESS[LIGHTNESS.length - 1]!, anchorL)

  const remapLightness = (index: number): number => {
    if (index === anchorIndex) return anchorL

    if (index < anchorIndex) {
      // Fraction of the way from the anchor to the lightest step, measured on
      // the original ramp so the relative spacing of the shades is preserved.
      const span = LIGHTNESS[0]! - targetAnchorL
      const t = span === 0 ? 0 : (LIGHTNESS[index]! - targetAnchorL) / span
      return anchorL + t * (lightEnd - anchorL)
    }

    const span = targetAnchorL - LIGHTNESS[LIGHTNESS.length - 1]!
    const t = span === 0 ? 0 : (targetAnchorL - LIGHTNESS[index]!) / span
    return anchorL - t * (anchorL - darkEnd)
  }

  const scale: Record<number, string> = {}
  for (const [index, step] of STEPS.entries()) {
    scale[step] = format({
      l: remapLightness(index),
      c: Math.min(peakChroma * CHROMA_FACTOR[index]!, chromaCap),
      h: source.h
    })
  }

  return scale
}

/**
 * Emit the ramp as CSS custom property declarations for one Tailwind palette.
 *
 * The name is the *palette* (`brand`, `greyscale`), producing `--color-brand-500`
 * and so on. That is deliberately not `--ui-color-primary-500`: Nuxt UI owns
 * those and defines each as `var(--color-<palette>-<shade>)` based on
 * app.config.ts. Redefining the palette therefore flows through to every role
 * mapped to it, whereas writing the `--ui-color-*` variables directly would be
 * overwritten by Nuxt UI's own colour plugin.
 */
export function scaleToCssVars(name: string, scale: Record<number, string>): string {
  return STEPS
    .map(step => `--color-${name}-${step}: ${scale[step]};`)
    .join('')
}
