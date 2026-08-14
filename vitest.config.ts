import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Server-side suite. Everything under test is Node code — h3 handlers, the
// database layer, the mail templates, the sweep — so there is no DOM
// environment and no Vue component rendering here.
//
// One project rather than two, because the end-to-end tests want the same
// stubbed config as the rest: it points them at the test database, which is what
// lets an HTTP test assert on the rows and files the request produced.
export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/setup/globalSetup.ts'],
    setupFiles: ['./test/setup/nitroGlobals.ts'],
    include: ['test/**/*.test.ts'],
    // The suite shares one database and one storage root, so files must not run
    // concurrently — two of them truncating tables at once would be a coin toss.
    // Within a file, tests are ordered and sequential by default.
    fileParallelism: false,
    // Starting a Nuxt server for the e2e files takes appreciably longer than the
    // 5s default allows.
    testTimeout: 120_000,
    hookTimeout: 180_000
  },

  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url))
    }
  }
})
