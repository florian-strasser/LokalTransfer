// Select the active locale from NUXT_LANGUAGE at runtime.
//
// Both locales are bundled at build time because nuxt.config.ts is evaluated
// during the build, when the environment variable isn't available yet. This
// plugin applies the configured one once the server is actually running, so a
// single build can be deployed with any supported language.
//
// Both the ordering and the `await` matter. `dependsOn` puts this immediately
// after i18n has installed itself (`enforce: 'pre'` would run it first, when
// `$i18n` doesn't exist yet), and awaiting `setLocale` lets the locale's messages
// finish loading. Pages call `t()` eagerly during `setup` — for `useSeoMeta`,
// mostly — so a switch that hasn't completed leaves the first server-rendered
// page in the default language while `<html lang>` already claims otherwise.
export default defineNuxtPlugin({
  name: 'i18n-locale',
  dependsOn: ['i18n:plugin'],

  async setup(nuxtApp) {
    // Read from the public config: this plugin runs in the browser as well, and
    // the server-only key would be undefined there.
    const configured = String(useRuntimeConfig().public.language || 'en')
      .toLowerCase()
      .slice(0, 2)

    // Typed loosely on purpose: only three members are needed here, and the full
    // i18n instance type isn't exported in a form usable from a plugin.
    const i18n = nuxtApp.$i18n as {
      availableLocales?: string[]
      locale: { value: string }
      setLocale: (code: string) => void | Promise<void>
    } | undefined

    if (!i18n) return

    const available: string[] = i18n.availableLocales || []
    if (available.includes(configured) && i18n.locale.value !== configured) {
      await i18n.setLocale(configured)
    }
  }
})
