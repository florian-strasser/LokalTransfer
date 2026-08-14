import { buildFaviconSvg } from '../utils/favicon'

// Favicon, served dynamically so it picks up the instance's configured accent
// colour at runtime (NUXT_PUBLIC_COLOR_PRIMARY) rather than a build-time
// default. The same single build can then be deployed with any brand colour and
// the tab icon follows, exactly like the rest of the theme.
export default defineEventHandler((event) => {
  const { colorPrimary } = useRuntimeConfig(event).public

  setHeader(event, 'content-type', 'image/svg+xml; charset=utf-8')
  // Browsers cache favicons aggressively regardless; a modest TTL lets a colour
  // change (env edit + restart) show up on the next visit rather than needing a
  // hard refresh.
  setHeader(event, 'cache-control', 'public, max-age=3600')

  return buildFaviconSvg(String(colorPrimary))
})
