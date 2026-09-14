import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Nuxt maps `runtimeConfig.public.foo` to the environment variable
// `NUXT_PUBLIC_FOO`, and to nothing else. So a public key written as
// `foo: process.env.NUXT_FOO` is not configuration at all: `nuxt.config.ts` runs
// during the build, so the value is whatever the *build machine* had, and no
// variable can change it afterwards.
//
// It shipped that way. On a prebuilt Docker image — the way this app is meant to
// run — NUXT_APP_NAME, NUXT_LANGUAGE, NUXT_MAX_FILE_SIZE_MB,
// NUXT_MAX_FILES_PER_TRANSFER, NUXT_DEFAULT_RETENTION_DAYS and NUXT_TIMEZONE
// were all silently ignored by the interface, while appearing to work in
// development, where the build and the run share one environment.
//
// The mistake is invisible at the call site and costs nothing to make again, so
// it is pinned here rather than left to review.

const source = readFileSync(
  fileURLToPath(new URL('../../nuxt.config.ts', import.meta.url)),
  'utf8'
)

/** The body of a `key: {` … `}` block, matched by counting braces. */
function block(text: string, opening: string): string {
  const start = text.indexOf(opening)
  expect(start, `expected to find "${opening}" in nuxt.config.ts`).toBeGreaterThan(-1)

  let depth = 0
  for (let i = start + opening.length - 1; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return text.slice(start, i)
  }

  throw new Error(`unbalanced braces after "${opening}"`)
}

const runtimeConfig = block(source, 'runtimeConfig: {')
const publicBlock = block(runtimeConfig, 'public: {')
const serverBlock = runtimeConfig.replace(publicBlock, '')

const envNames = (text: string) =>
  [...text.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(match => match[1]!)

describe('runtimeConfig.public', () => {
  it('only holds keys their environment variable can actually reach', () => {
    const wrong = envNames(publicBlock).filter(name => !name.startsWith('NUXT_PUBLIC_'))

    expect(
      wrong,
      `these are read from runtimeConfig.public but their variable has no PUBLIC_ segment, `
      + `so they are frozen at build time and cannot be configured at runtime. `
      + `Either rename them to NUXT_PUBLIC_*, or move them to the server-side block `
      + `and carry them to the browser through useSettings().`
    ).toEqual([])
  })

  it('is not empty, so the check above is actually looking at something', () => {
    expect(envNames(publicBlock).length).toBeGreaterThan(0)
  })
})

describe('the settings useSettings() resolves', () => {
  // These six are read by the browser but configured without a PUBLIC_ segment,
  // so they have to live server-side and travel in the payload. If one were
  // moved back into `public`, the test above would catch it; this catches the
  // opposite mistake of dropping it from the config entirely, which would leave
  // useSettings() silently resolving its fallback.
  const required = [
    'NUXT_APP_NAME',
    'NUXT_LANGUAGE',
    'NUXT_MAX_FILE_SIZE_MB',
    'NUXT_MAX_FILES_PER_TRANSFER',
    'NUXT_DEFAULT_RETENTION_DAYS',
    'NUXT_TIMEZONE'
  ]

  it.each(required)('%s is still a server-side runtimeConfig key', (name) => {
    expect(envNames(serverBlock)).toContain(name)
  })
})
