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
    // Resolved on the server and carried to the browser in the payload, rather
    // than read from the public config directly.
    //
    // The locale lives in runtimeConfig twice — `language` for the server (mail,
    // rendered on a timer with no browser involved) and `public.language` for
    // the interface — and Nuxt maps an environment variable to exactly one of
    // them. `NUXT_LANGUAGE` reaches only the first. So an instance started with
    // `NUXT_LANGUAGE=de` sent German mail and served an English interface, and
    // setting the documented variable could never fix it. That bites hardest in
    // Docker, where the image is built once with the defaults baked in and
    // configured purely through the environment — which is how this app is meant
    // to run.
    //
    // Mutating `public` in a Nitro plugin is not the way out: it is frozen in
    // production and assigning to it crashes the server on boot. Seeding a
    // `useState` on the server is, because its value is serialised into the
    // payload and the browser picks up whatever the server resolved.
    const language = useState('lokaltransfer-language', () => {
      const config = useRuntimeConfig()
      // The server-only key exists only during SSR; on the client this
      // initialiser never runs, since the payload already carries the value.
      return String(
        (import.meta.server ? config.language : '') || config.public.language || 'en'
      )
    })

    const configured = language.value.toLowerCase().slice(0, 2)

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
