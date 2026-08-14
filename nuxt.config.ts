import pkg from './package.json'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@nuxtjs/mcp-toolkit'
  ],

  devtools: {
    enabled: true
  },

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      // The title template and the html lang attribute are set at runtime in
      // app.vue from runtimeConfig (NUXT_APP_NAME / NUXT_LANGUAGE), because
      // this config is evaluated at build time when those aren't available.
      // The values here are only static fallbacks.
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'format-detection', content: 'telephone=no' }
      ],
      // Generated at runtime from NUXT_PUBLIC_COLOR_PRIMARY, so the tab icon
      // follows the instance's accent colour without a rebuild.
      // See server/routes/favicon.svg.get.ts.
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  // The theme follows the operating system and cannot be overridden in the app —
  // there is no toggle anywhere in the UI.
  //
  // `storageKey` is deliberately a fresh name. @nuxtjs/color-mode has no way to
  // switch persistence off, and a value stored under the old key by a browser
  // that once used the toggle would still win over `preference`. Pointing at an
  // unused key means there is never anything stored to override the system
  // setting, and with the toggle gone nothing ever writes to it either.
  colorMode: {
    preference: 'system',
    // Used only where the OS expresses no preference at all.
    fallback: 'light',
    storageKey: 'lokaltransfer-color-mode-unused'
  },

  // Every environment-specific value is read through runtimeConfig rather than
  // process.env at build time, which is the only way env variables reliably
  // reach a built Nuxt app. Public keys are exposed to the browser (the theme
  // colours have to be, to render), everything else stays server-side.
  runtimeConfig: {
    public: {
      appName: process.env.NUXT_APP_NAME || 'LokalTransfer',
      // Public because the browser needs it too: the locale plugin runs on both
      // sides, and if the client couldn't see the configured language it would
      // fall back to the default and hydrate over the server's markup with the
      // wrong messages.
      language: process.env.NUXT_LANGUAGE || 'en',
      // The single accent colour. A full 50–950 ramp is derived from this hex at
      // runtime (see app/utils/colorScale.ts), so one variable themes the whole
      // app. Everything else is neutral by design.
      colorPrimary: process.env.NUXT_PUBLIC_COLOR_PRIMARY || '#CC0030',
      colorPrimaryDark: process.env.NUXT_PUBLIC_COLOR_PRIMARY_DARK || '#DE0F3B',
      // The neutral ramp (white → grey → black). Keep it desaturated; a hex with
      // chroma here would reintroduce a second colour.
      colorNeutral: process.env.NUXT_PUBLIC_COLOR_NEUTRAL || '#71717A',
      colorNeutralDark: process.env.NUXT_PUBLIC_COLOR_NEUTRAL_DARK || '#71717A',
      // Maximum size of a single file, in megabytes. Mirrored server-side by
      // maxFileSizeMb below; this copy only drives client-side pre-validation.
      maxFileSizeMb: process.env.NUXT_MAX_FILE_SIZE_MB || '2048',
      maxFilesPerTransfer: process.env.NUXT_MAX_FILES_PER_TRANSFER || '50',
      // Default retention in days. "0" means keep forever.
      defaultRetentionDays: process.env.NUXT_DEFAULT_RETENTION_DAYS || '14',
      // Background image shown behind the composer, the download page and the
      // sign-in screen. Either a full URL or a path to something in public/.
      // A sender can override it per transfer; this is the instance default.
      backgroundImage: process.env.NUXT_PUBLIC_BACKGROUND_IMAGE || '',
      // Optional destination when the background is clicked — for crediting a
      // photographer, or pointing at your own site.
      backgroundLink: process.env.NUXT_PUBLIC_BACKGROUND_LINK || '',
      backgroundCredit: process.env.NUXT_PUBLIC_BACKGROUND_CREDIT || '',

      privacyUrl: process.env.NUXT_PUBLIC_PRIVACY_URL || '',
      imprintUrl: process.env.NUXT_PUBLIC_IMPRINT_URL || '',
      timezone: process.env.NUXT_TIMEZONE || 'Europe/Berlin'
    },

    appName: process.env.NUXT_APP_NAME || 'LokalTransfer',
    language: process.env.NUXT_LANGUAGE || 'en',
    appUrl: process.env.NUXT_APP_URL || 'http://localhost:3000',
    // Instants are stored and compared in UTC; this is only the zone dates are
    // rendered in for people (expiry dates in mail and in the UI).
    timezone: process.env.NUXT_TIMEZONE || 'Europe/Berlin',
    // How many days a member login session stays valid.
    sessionMaxAgeDays: process.env.NUXT_SESSION_MAX_AGE_DAYS || '7',
    // Guest sessions are deliberately short: a magic link is a one-off errand,
    // not a standing login.
    guestSessionMaxAgeHours: process.env.NUXT_GUEST_SESSION_MAX_AGE_HOURS || '12',
    magicLinkMaxAgeMinutes: process.env.NUXT_MAGIC_LINK_MAX_AGE_MINUTES || '30',

    // First-run administrator. Because there is no public signup, an instance
    // with no admin can't create one through the UI — so these seed one at
    // startup when none exists. Only ever used when the instance has no
    // administrator at all; an existing account's password is never touched.
    // See server/plugins/1.bootstrap-admin.ts.
    adminEmail: process.env.NUXT_ADMIN_EMAIL || '',
    adminPassword: process.env.NUXT_ADMIN_PASSWORD || '',
    adminName: process.env.NUXT_ADMIN_NAME || 'Administrator',

    // Where uploaded files live. Deliberately outside public/ so nothing is
    // reachable without going through the token check in the download handler.
    storagePath: process.env.NUXT_STORAGE_PATH || './storage',
    maxFileSizeMb: process.env.NUXT_MAX_FILE_SIZE_MB || '2048',
    maxFilesPerTransfer: process.env.NUXT_MAX_FILES_PER_TRANSFER || '50',
    defaultRetentionDays: process.env.NUXT_DEFAULT_RETENTION_DAYS || '14',
    // Drafts are transfers whose upload was started but never sent. They are
    // swept after this many hours so abandoned uploads don't fill the disk.
    draftMaxAgeHours: process.env.NUXT_DRAFT_MAX_AGE_HOURS || '24',
    // How long before a transfer lapses its sender gets a one-off warning that
    // the files are about to be deleted. "0" switches the warning off. The
    // warning is skipped for any transfer whose whole life is shorter than this,
    // since a warning that arrives with the transfer itself is just noise.
    expiryWarningHours: process.env.NUXT_EXPIRY_WARNING_HOURS || '24',

    mysqlHost: process.env.NUXT_MYSQL_HOST || 'localhost',
    mysqlDatabase: process.env.NUXT_MYSQL_DATABASE || 'lokaltransfer',
    mysqlUser: process.env.NUXT_MYSQL_USER || 'root',
    mysqlPassword: process.env.NUXT_MYSQL_PASSWORD || 'root1234',
    mysqlSsl: process.env.NUXT_MYSQL_SSL || '',
    mysqlSslRejectUnauthorized: process.env.NUXT_MYSQL_SSL_REJECT_UNAUTHORIZED || '',

    emailHost: process.env.NUXT_EMAIL_HOST || 'mail.yourserver.de',
    emailPort: process.env.NUXT_EMAIL_PORT || '465',
    emailSecure: process.env.NUXT_EMAIL_SECURE || 'true',
    emailUser: process.env.NUXT_EMAIL_USER || 'contact@yourdomain.com',
    emailPass: process.env.NUXT_EMAIL_PASS || 'password1234',
    emailFrom: process.env.NUXT_EMAIL_FROM || '',
    // Set to "json" to render mail without sending it — used by the test suite,
    // and useful for trying the app out before SMTP is configured. Anything else
    // means real delivery.
    emailTransport: process.env.NUXT_EMAIL_TRANSPORT || ''
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    experimental: {
      tasks: true,
      // Required by `useEvent()`, which the MCP tools use to reach the request —
      // a tool handler is called by the MCP server, not by Nitro, so the event
      // can't be passed down as an argument the way a route handler gets it.
      asyncContext: true
    },
    scheduledTasks: {
      // Delete expired transfers (files + rows) and sweep abandoned drafts.
      '*/15 * * * *': ['cleanup']
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // Inter is the only family the UI uses. Declared explicitly so the build
  // fetches exactly the weights the interface needs and nothing more — the
  // defaults would pull a wider range and inflate what gets self-hosted.
  //
  // `latin-ext` is included for names in the user list and on transfers, which
  // routinely carry accents the base latin subset doesn't cover.
  fonts: {
    families: [
      {
        name: 'Inter',
        provider: 'google',
        weights: [400, 500, 600, 700],
        styles: ['normal'],
        subsets: ['latin', 'latin-ext']
      }
    ]
  },

  i18n: {
    // Both locales are bundled and the active one is chosen at runtime from
    // NUXT_LANGUAGE (see app/plugins/i18n-locale.ts), because this config is
    // evaluated at build time when the env variable isn't available yet.
    // "no_prefix" keeps URLs clean — download links must not carry a locale.
    strategy: 'no_prefix',
    defaultLocale: 'en',
    detectBrowserLanguage: false,
    locales: [
      { code: 'en', file: 'en.json' },
      { code: 'de', file: 'de.json' }
    ]
  },

  // The MCP server, mounted at /mcp, letting an agent send transfers on someone's
  // behalf.
  //
  // Always built in rather than gated on an env flag: `enabled` is read at build
  // time, so a flag here would do nothing for a self-hoster running a prebuilt
  // image — exactly the case it would be meant for. The endpoint carries no
  // authority of its own; every call needs a valid API key, the same credential
  // the REST API takes, and an instance that issues no keys exposes nothing.
  mcp: {
    name: process.env.NUXT_APP_NAME || 'LokalTransfer',
    // Read from package.json rather than written out again here. LokalBoards
    // carried a second copy of this number and it sat two releases behind, so
    // every MCP client saw the wrong version — one place for it, from the start.
    version: pkg.version
  }
})
