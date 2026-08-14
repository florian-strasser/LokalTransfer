<script setup lang="ts">
// The full-bleed background behind the composer, the download page and sign-in.
//
// Two sources, in order: a per-transfer image the sender uploaded, else the
// instance default from NUXT_PUBLIC_BACKGROUND_IMAGE. With neither, the page
// falls back to the plain themed background and nothing here renders.
const props = defineProps<{
  /**
   * A transfer's own background URL, when the page has one. Takes precedence
   * over the instance default.
   */
  src?: string | null
}>()

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
         The panels themselves are translucent-but-blurred, which carries most of
         the contrast; this only has to protect the loose text outside them — the
         app name at the top and the expiry line at the bottom. Hence a light
         overall wash plus a stronger gradient at the edges, rather than one
         heavy scrim that would flatten the image into grey. -->
    <div class="absolute inset-0 bg-white/25 dark:bg-black/45" />
    <div
      class="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/60 dark:from-black/70 dark:via-transparent dark:to-black/70"
    />
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
