import { describe, expect, it } from 'vitest'
import { buildColorScale, hexToOklch, scaleToCssVars } from '../../app/utils/colorScale'

// One env variable themes the whole interface, so this ramp is generated at
// runtime from a single hex. Two properties matter and neither is obvious from
// reading the code: the ramp must stay monotonic whatever colour is configured
// (it did not, at first — 500 came out darker than 600), and a typo must degrade
// to the default rather than emitting a stylesheet that strips every colour from
// the page.

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

// Values look like `oklch(53.42% 0.2149 21.19)`.
const OKLCH = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/

/** Perceived lightness of each step, in ramp order, normalised to 0..1. */
function lightnesses(scale: Record<number, string>): number[] {
  return STEPS.map((step) => {
    const match = OKLCH.exec(scale[step]!)
    expect(match, `step ${step} should be an oklch() colour, got ${scale[step]}`).not.toBeNull()
    return Number(match![1]) / 100
  })
}

/** Chroma of each step. */
function chromas(scale: Record<number, string>): number[] {
  return STEPS.map(step => Number(OKLCH.exec(scale[step]!)![2]))
}

describe('hexToOklch', () => {
  it('parses the shapes a person might type into an env file', () => {
    expect(hexToOklch('#CC0030')).not.toBeNull()
    expect(hexToOklch('CC0030')).not.toBeNull()
    expect(hexToOklch('#c03')).not.toBeNull()
  })

  it('returns null for anything unparseable, rather than a wrong colour', () => {
    for (const value of ['', 'red', '#12345', '#GGGGGG', 'rgb(1,2,3)']) {
      expect(hexToOklch(value), value).toBeNull()
    }
  })

  it('reads black and white as the ends of the lightness axis', () => {
    expect(hexToOklch('#000000')!.l).toBeCloseTo(0, 2)
    expect(hexToOklch('#FFFFFF')!.l).toBeCloseTo(1, 2)
  })
})

describe('buildColorScale', () => {
  it('produces all eleven Tailwind steps', () => {
    const scale = buildColorScale('#CC0030', '#CC0030')
    expect(Object.keys(scale).map(Number).sort((a, b) => a - b)).toEqual(STEPS)
  })

  it('gets darker at every step, for any configured colour', () => {
    // The bug this exists to prevent: anchoring the configured hex at step 500
    // without stretching the rest made 500 darker than 600, so a hover state
    // came out lighter than its resting state.
    const colours = [
      '#CC0030', // the brand red
      '#DE0F3B', // its dark-mode variant
      '#0066CC', // LokalBoards blue — much darker than step 500 expects
      '#FFFF00', // very light
      '#000080', // very dark
      '#71717A' // the neutral
    ]

    for (const hex of colours) {
      const values = lightnesses(buildColorScale(hex, '#CC0030'))
      for (let i = 1; i < values.length; i++) {
        expect(
          values[i]!,
          `${hex}: step ${STEPS[i]} should be darker than ${STEPS[i - 1]}`
        ).toBeLessThan(values[i - 1]!)
      }
    }
  })

  it('runs from near-white to near-black', () => {
    const values = lightnesses(buildColorScale('#CC0030', '#CC0030'))
    expect(values[0]).toBeGreaterThan(0.9)
    expect(values[values.length - 1]).toBeLessThan(0.3)
  })

  it('anchors the configured colour on the step that will be used', () => {
    // Light mode resolves the accent to step 500 and dark mode to 400, so each
    // is anchored separately — otherwise the button would not be the colour the
    // env variable names.
    const source = hexToOklch('#0066CC')!

    const light = lightnesses(buildColorScale('#0066CC', '#CC0030', { anchor: 500 }))
    expect(light[STEPS.indexOf(500)]).toBeCloseTo(source.l, 2)

    const dark = lightnesses(buildColorScale('#0066CC', '#CC0030', { anchor: 400 }))
    expect(dark[STEPS.indexOf(400)]).toBeCloseTo(source.l, 2)
  })

  it('falls back to the default when the hex is unparseable', () => {
    // An `.env` with an unquoted `#` yields an empty string, which is exactly how
    // this was discovered in the wild.
    const broken = buildColorScale('', '#CC0030')
    const good = buildColorScale('#CC0030', '#CC0030')
    expect(broken).toEqual(good)
  })

  it('still produces a usable ramp when even the fallback is broken', () => {
    // A stylesheet with invalid colours strips every colour from the page, so
    // there is no acceptable "emit nothing" branch here.
    const scale = buildColorScale('nonsense', 'also nonsense')
    expect(Object.keys(scale)).toHaveLength(11)
    for (const step of STEPS) expect(scale[step]).toMatch(/^oklch\(/)
  })

  it('caps chroma so the neutral ramp cannot smuggle in a second colour', () => {
    // The whole design is neutral plus exactly one accent. A neutral hex with
    // real saturation would quietly break that.
    const capped = buildColorScale('#CC0030', '#CC0030', { maxChroma: 0.002 })

    for (const chroma of chromas(capped)) {
      expect(chroma).toBeLessThanOrEqual(0.002)
    }
  })
})

describe('scaleToCssVars', () => {
  it('emits one custom property per step, under the given name', () => {
    const css = scaleToCssVars('brand', buildColorScale('#CC0030', '#CC0030'))

    for (const step of STEPS) {
      expect(css).toContain(`--color-brand-${step}:`)
    }
  })
})
