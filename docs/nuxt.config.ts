import tailwindcss from '@tailwindcss/vite'

// The marketing and documentation site for LokalTransfer, kept as its own Nuxt
// project rather than routes inside the app.
//
// The app is a private tool: it has no public pages, refuses to be indexed, and
// every route behind sign-in. This site is the opposite of all three — public,
// indexed, and statically generated with `nuxt generate`, so it can be served
// from anywhere without a database or a Node process. Merging them would mean
// one deployment that is both, and the app carrying a marketing bundle it never
// serves.
const appName = 'LokalTransfer'

// The canonical host, shared by the sitemap and the absolute URLs a social card
// needs — a crawler has no page to resolve a relative one against.
const siteURL = 'https://lokaltransfer.com'

export default defineNuxtConfig({

  modules: ['@nuxt/content', 'nuxt-llms', '@nuxtjs/sitemap', 'motion-v/nuxt'],

  ssr: true,
  devtools: { enabled: true },

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      // Used alone for a page that sets no title, and as the suffix behind every
      // page that does — pages set theirs through `usePageMeta`.
      title: appName,
      titleTemplate: `%s | ${appName}`,
      htmlAttrs: { lang: 'en' },
      meta: [
        // An empty default so a page without its own description still emits the
        // tag; `usePageMeta` replaces it wherever the content supplies one.
        { name: 'description', content: '' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'theme-color', content: '#ffffff' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: appName },
        { property: 'og:image', content: `${siteURL}/images/og-card.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        {
          property: 'og:image:alt',
          content: `${appName} — self-hosted file transfer with expiring links`
        },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: `${siteURL}/images/og-card.png` }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  site: {
    url: siteURL,
    name: appName,
    trailingSlash: true
  },
  compatibilityDate: '2025-07-15',

  vite: {
    plugins: [tailwindcss()]
  },
  telemetry: false,

  llms: {
    domain: siteURL,
    title: appName,
    description:
      'Documentation for LokalTransfer — self-hosted file transfer with expiring '
      + 'links, a REST API and an MCP server.',
    contentRawMarkdown: {
      excludeCollections: ['content']
    }
  },

  sitemap: {
    // Scanning app/pages finds the static routes. Everything under /docs/<slug>
    // and /api/<slug> is one dynamic route backed by a Markdown file, so those
    // come from the endpoint instead.
    sources: ['/__sitemap__/urls']
  }
})
