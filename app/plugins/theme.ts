import { buildColorScale, scaleToCssVars } from '../utils/colorScale'

// Push the configured theme colours into the page as CSS custom properties.
//
// Nuxt UI resolves its own `--ui-color-<role>-<shade>` variables from a named
// Tailwind palette (see app.config.ts, which points every role at `brand` or
// `greyscale`). So instead of fighting Nuxt UI's own colour plugin, this one
// redefines the two palettes it reads from.
//
// The declarations are emitted *unlayered*. Both Tailwind's `@theme` block and
// Nuxt UI's colour plugin write inside `@layer theme`, and unlayered styles beat
// layered ones regardless of source order — so these values win without needing
// to out-specify anything or control plugin order.
//
// This runs during SSR as well, so the correct colours are in the initial HTML
// and there's no flash of the fallback palette.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public

  const DEFAULT_PRIMARY = '#CC0030'
  const DEFAULT_PRIMARY_DARK = '#DE0F3B'
  const DEFAULT_NEUTRAL = '#71717A'

  // Anchored so the configured hex lands on the shade Nuxt UI actually resolves
  // `--ui-primary` to: shade 500 in light mode, shade 400 in dark mode. The
  // colour on a button is then exactly the one that was configured, not an
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

  // `.dark` and `:root` have identical specificity, so the dark block has to
  // come second to win when the class is present.
  const css = [
    `:root{${scaleToCssVars('brand', primary)}${scaleToCssVars('greyscale', neutral)}}`,
    `.dark{${scaleToCssVars('brand', primaryDark)}${scaleToCssVars('greyscale', neutralDark)}}`
  ].join('')

  useHead({
    style: [{ innerHTML: css, tagPriority: 'critical', id: 'lokaltransfer-theme' }]
  })
})
