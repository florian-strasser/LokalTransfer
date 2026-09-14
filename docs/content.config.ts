import { defineContentConfig, defineCollection } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    // `content` holds the legal pages. They are served at /privacy-policy and
    // /site-notice by real page components, so their content paths deliberately
    // do not match their routes.
    content: defineCollection({ type: 'page', source: 'legal/*.md' }),
    docs: defineCollection({ type: 'page', source: 'docs/*.md' }),
    api: defineCollection({ type: 'page', source: 'api/*.md' })
  }
})
