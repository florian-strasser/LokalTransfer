// Colours whose filled state is the brand accent. Deliberately excludes
// `neutral`: its filled state uses `bg-inverted`, which is a *light* surface in
// dark mode and needs dark text on it. Lumping the two together is exactly the
// mistake the overrides below exist to avoid.
const BRAND_COLORS = ['primary', 'secondary', 'success', 'info', 'warning', 'error'] as const

export default defineAppConfig({
  ui: {
    colors: {
      // Every semantic role points at the same accent palette. The design brief
      // is a neutral interface with exactly one colour, so an alert or a
      // validation error must not introduce red or amber of its own — they're
      // distinguished by icon and wording instead.
      //
      // `brand` and `greyscale` are our own Tailwind palettes: a static fallback
      // ramp lives in assets/css/main.css and the real values are injected at
      // runtime from NUXT_PUBLIC_COLOR_* by app/plugins/theme.ts.
      primary: 'brand',
      secondary: 'brand',
      success: 'brand',
      info: 'brand',
      warning: 'brand',
      error: 'brand',
      neutral: 'greyscale'
    },

    // Every tile gets the same lift off the grey page. This was previously only
    // on the cards floating over the background image (sign-in, composer,
    // download), which left the signed-in pages looking flat by comparison —
    // the shadow is what reads as "tile on a page" rather than "panel drawn on
    // a panel". Set here rather than per page so a new card can't miss it.
    card: {
      slots: {
        root: 'shadow-xl'
      }
    },

    // --- White on the accent, in both themes ---------------------------------
    //
    // Nuxt UI paints text on a brand fill with `text-inverted`, and
    // `--ui-text-inverted` flips to a dark colour in dark mode — so a filled
    // button or an active tab came out dark-on-blue there. The brand wants white
    // on blue in both themes.
    //
    // Fixed per component rather than by redefining `--ui-text-inverted`,
    // because that token is *also* what keeps an inverted surface readable (dark
    // text on the light `bg-inverted`). Forcing it white would trade this bug
    // for a worse one: white on white.
    //
    // Any future component that puts text on a brand fill needs the same entry —
    // check for `text-inverted` alongside `bg-<color>` in its theme.
    button: {
      compoundVariants: [
        {
          color: [...BRAND_COLORS],
          variant: 'solid',
          class: 'text-white'
        }
      ]
    },

    tabs: {
      // The track keeps its stock `bg-elevated`, which is the right choice for
      // the common case: tabs sitting *inside* a white tile, where a step off
      // white is what makes the track visible.
      //
      // Tabs placed directly on the grey page need the opposite — there,
      // `bg-elevated` is nearly the page colour and the track disappears. Those
      // pass `:ui="{ list: 'bg-default' }"` at the call site (see the dashboard).
      // Setting it globally here breaks every in-card usage, which is exactly
      // what happened when this was tried the other way round.
      compoundVariants: [
        {
          color: [...BRAND_COLORS],
          variant: 'pill',
          class: {
            // Only the selected tab sits on the fill; the rest keep muted text.
            trigger: 'data-[state=active]:text-white'
          }
        }
      ]
    }
  }
})
