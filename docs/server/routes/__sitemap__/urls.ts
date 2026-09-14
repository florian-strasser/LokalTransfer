import { defineEventHandler } from 'h3'
import { queryCollection } from '@nuxt/content/server'

// Sitemap source for the routes @nuxtjs/sitemap cannot find by itself.
//
// Scanning app/pages finds the static routes (/, /docs/, /api/, the two legal
// pages), but every documentation and reference page is served by a single
// dynamic route whose slugs exist only as Markdown files. So they are read back
// out of the content database here.
//
// This lives at /__sitemap__/urls rather than the module's default
// /api/__sitemap__/urls: the site has its own /api/ section for the REST
// documentation, and a server route hiding inside it would confuse anyone
// reading the routes later.
//
// The legal collection is deliberately excluded. Its files sit under
// content/legal/, so their content paths are not the routes they are served at —
// and those routes are real pages, which page scanning already has.
export default defineEventHandler(async (event) => {
  const sections = ['docs', 'api'] as const

  const pages = await Promise.all(
    sections.map(section => queryCollection(event, section).select('path').all())
  )

  return pages.flat().flatMap((page) => {
    const loc = page?.path
    if (!loc) return []
    // The section landing pages are already contributed by page scanning.
    if (/^\/(docs|api)\/?$/.test(loc)) return []
    return [{ loc }]
  })
})
