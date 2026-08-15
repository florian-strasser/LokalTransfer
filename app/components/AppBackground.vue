<script setup lang="ts">
// The full-bleed background behind the composer, the download page and sign-in.
//
// Two sources, in order: a per-transfer image the sender uploaded, else the
// instance default from NUXT_PUBLIC_BACKGROUND_IMAGE. With neither, the page
// falls back to the plain themed background and nothing here renders.
const props = withDefaults(defineProps<{
  /**
   * A transfer's own background URL, when the page has one. Takes precedence
   * over the instance default.
   */
  src?: string | null
  /**
   * Whether to wash the image out to protect text sitting *outside* the panels.
   *
   * On by default, because most pages using this have some: the composer has a
   * heading and the nav above its widget, sign-in has the no-sign-up line below
   * its card. The download page has none — it is chrome-free and the expiry
   * moved inside the card — so it turns this off and shows the photograph as it
   * actually is, which is the whole reason a sender picks one.
   */
  scrim?: boolean
}>(), {
  src: null,
  scrim: true
})

const config = useRuntimeConfig().public

const image = computed(() => props.src || String(config.backgroundImage || '') || null)

// The credit link belongs to the instance default. A sender's own background
// isn't the photographer's, so it carries no attribution.
const link = computed(() =>
  (!props.src && config.backgroundLink ? String(config.backgroundLink) : null))
const credit = computed(() =>
  (!props.src && config.backgroundCredit ? String(config.backgroundCredit) : null))
</script>

<template>
  <div
    v-if="image"
    class="pointer-events-none fixed inset-0 -z-10"
    aria-hidden="true"
  >
    <img
      :src="image"
      alt=""
      class="size-full object-cover"
      loading="eager"
      decoding="async"
    >
    <!-- A photo can be light or dark anywhere, so legibility can't depend on it.
         The panels carry their own opaque surface, so this only protects text
         loose on the page. A light overall wash plus a stronger gradient at the
         edges, rather than one heavy scrim that would flatten the image to grey —
         and skipped entirely where there is no such text, since washing out a
         photograph nobody needs to read through only hides what the sender chose
         it for. -->
    <template v-if="scrim">
      <div class="absolute inset-0 bg-white/25 dark:bg-black/45" />
      <div
        class="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/60 dark:from-black/70 dark:via-transparent dark:to-black/70"
      />
    </template>
  </div>

  <!-- Credit sits outside the aria-hidden layer and re-enables pointer events,
       so it stays clickable and readable to screen readers. -->
  <a
    v-if="image && link"
    :href="link"
    target="_blank"
    rel="noopener noreferrer"
    class="fixed bottom-3 right-3 z-10 rounded-md bg-default/70 px-2 py-1 text-xs text-muted backdrop-blur transition-colors hover:text-default"
  >
    {{ credit || link }}
  </a>
  <span
    v-else-if="image && credit"
    class="fixed bottom-3 right-3 z-10 rounded-md bg-default/70 px-2 py-1 text-xs text-muted backdrop-blur"
  >
    {{ credit }}
  </span>
</template>
