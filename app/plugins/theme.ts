import { buildColorScale, scaleToCssVars } from '../utils/colorScale'

// Push the configured theme colours into the page as CSS custom properties.
//
// Two eleven-step ramps are generated — `brand` from the accent, `greyscale`
// from the neutral — and written over the fallback ramps in main.css. Every
// colour role in the stylesheet (`--lt-primary`, `--lt-text-muted`, …) reads
// one shade of one of them, so these two blocks theme the whole interface.
//
// The declarations are emitted *unlayered*. Tailwind's `@theme` block writes
// the fallbacks inside `@layer theme`, and unlayered styles beat layered ones
// regardless of source order — so these values win without needing to
// out-specify anything.
//
// This runs during SSR as well, so the correct colours are in the initial HTML
// and there's no flash of the fallback palette.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public

  const DEFAULT_PRIMARY = '#CC0030'
  const DEFAULT_PRIMARY_DARK = '#DE0F3B'
  const DEFAULT_NEUTRAL = '#71717A'

  // Anchored so the configured hex lands on the shade the accent resolves to:
  // shade 500 in light mode, shade 400 in dark mode (see main.css). The colour
  // on a button is then exactly the one that was configured, not an
  // approximation of it.
  const primary = buildColorScale(String(config.colorPrimary), DEFAULT_PRIMARY, {
    anchor: 500
  })
  const primaryDark = buildColorScale(String(config.colorPrimaryDark), DEFAULT_PRIMARY_DARK, {
    anchor: 400
  })

  // The neutral ramp is chroma-capped: the interface is meant to be greyscale
  // plus one accent, so a saturated hex slipped into NUXT_PUBLIC_COLOR_NEUTRAL
  // is desaturated rather than becoming a second colour. A trace of chroma is
  // still allowed, which is what makes a grey feel warm or cool.
  const NEUTRAL_MAX_CHROMA = 0.012
  const neutral = buildColorScale(String(config.colorNeutral), DEFAULT_NEUTRAL, {
    anchor: 500,
    maxChroma: NEUTRAL_MAX_CHROMA
  })
  const neutralDark = buildColorScale(String(config.colorNeutralDark), DEFAULT_NEUTRAL, {
    anchor: 500,
    maxChroma: NEUTRAL_MAX_CHROMA
  })

  // The theme follows the operating system, so the dark ramps sit behind the
  // same media query as the dark roles in main.css. Same specificity as the
  // light block, so it has to come second to win.
  const css = [
    `:root{${scaleToCssVars('brand', primary)}${scaleToCssVars('greyscale', neutral)}}`,
    `@media (prefers-color-scheme: dark){:root{${scaleToCssVars('brand', primaryDark)}${scaleToCssVars('greyscale', neutralDark)}}}`
  ].join('')

  useHead({
    style: [{ innerHTML: css, tagPriority: 'critical', id: 'lokaltransfer-theme' }]
  })
})
