/**
 * The instance's settings, as the browser sees them.
 *
 * Each of these comes from one environment variable — `NUXT_APP_NAME`,
 * `NUXT_LANGUAGE`, `NUXT_TIMEZONE` and so on — resolved on the server and
 * carried to the browser in the payload, rather than read from
 * `runtimeConfig.public`.
 *
 * That indirection exists because of a trap in how Nuxt maps environment
 * variables onto config. A key under `runtimeConfig.public` can only be
 * overridden at runtime by a variable whose name carries the `PUBLIC_` segment:
 * `public.appName` reads `NUXT_PUBLIC_APP_NAME`, never `NUXT_APP_NAME`. Writing
 * `appName: process.env.NUXT_APP_NAME` inside the `public` block therefore
 * configures nothing — `nuxt.config.ts` is evaluated during the build, so it
 * bakes in whatever the build machine happened to have, and at runtime no
 * variable can dislodge it.
 *
 * It is invisible in development, where the build and the run share one
 * environment, and total in Docker, where the image is built once with the
 * defaults and configured purely through the environment — which is how this app
 * is meant to run. Every variable below was silently ignored by the interface on
 * a prebuilt image: the app name, both upload limits, the default retention, and
 * the timezone every date is rendered in.
 *
 * So each value lives once, in the server-side config, and `useState` carries
 * what the server resolved into the payload. Mutating `runtimeConfig.public`
 * from a Nitro plugin is not an alternative: it is frozen in production and
 * assigning to it crashes the server on boot.
 */
export interface AppSettings {
  appName: string
  language: string
  maxFileSizeMb: number
  maxFilesPerTransfer: number
  defaultRetentionDays: number
  timezone: string
}

export function useSettings() {
  return useState<AppSettings>('lokaltransfer-settings', () => {
    // Server-only keys, so this initialiser only ever produces a real answer
    // during SSR. On the client it does not run at all — the payload already
    // carries the resolved object. The fallbacks are what an unrendered client
    // would get, and match the defaults in nuxt.config.ts.
    const config = useRuntimeConfig()

    return {
      appName: String(config.appName || 'LokalTransfer'),
      language: String(config.language || 'en'),
      maxFileSizeMb: Number(config.maxFileSizeMb) || 2048,
      maxFilesPerTransfer: Number(config.maxFilesPerTransfer) || 50,
      defaultRetentionDays: Number(config.defaultRetentionDays) || 14,
      timezone: String(config.timezone || 'Europe/Berlin')
    }
  })
}
