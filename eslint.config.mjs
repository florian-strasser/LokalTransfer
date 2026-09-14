// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // The documentation site is a second Nuxt project inside this repository, so
    // the generated config — which only knows about the app's own directories —
    // does not extend the framework's conventions to it.
    //
    // Nuxt names a route by its filename, so a page is `index.vue` or
    // `[slug].vue` whether it belongs to the app or the site. Requiring a
    // multi-word name there would mean renaming files the router derives its
    // URLs from.
    files: ['docs/app/pages/**/*.vue', 'docs/app/components/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  }
)
