import { testRuntimeConfig } from './testConfig'

// Nitro auto-imports a handful of globals into server code. Outside a Nitro
// process — which is what Vitest is — they simply don't exist, and importing
// anything under server/ throws on the first reference.
//
// Stubbing them here, rather than refactoring the app to take its config by
// argument, keeps the production code shaped by its own needs and means the
// tests exercise the real modules rather than a test-only variant of them.

type Global = typeof globalThis & {
  useRuntimeConfig?: () => typeof testRuntimeConfig
  defineTask?: <T>(task: T) => T
}

const g = globalThis as Global

// The event argument is ignored: every caller either passes an H3 event or
// nothing, and the answer is the same either way outside a request.
g.useRuntimeConfig = () => testRuntimeConfig

// `defineTask` is a plain identity marker in Nitro too, so the task's own `run`
// can be called directly.
g.defineTask = task => task
