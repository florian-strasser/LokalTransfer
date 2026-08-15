<script setup lang="ts">
// Layout for pages reachable without an account: sign-in, password recovery, the
// magic-link landing, the guest upload form and the public download page.
//
// Deliberately chrome-free. There is no header and no product name: these pages
// are the ones a stranger can reach, and on a company's own server the software
// being run is not something to advertise to whoever finds the URL. Pages that
// need an identity (the sign-in card) or a control (the guest's sign-out button)
// carry it in their own body instead.
//
// No navigation either — every destination in it would be closed to the person
// looking at the page.
const config = useRuntimeConfig().public

const privacyUrl = String(config.privacyUrl || '')
const imprintUrl = String(config.imprintUrl || '')

// A page can opt out of being centred with `definePageMeta({ align: 'left' })`
// or `'right'`.
//
// The download page does, so its card sits against one edge and the background
// image keeps the rest of the viewport — the reason the per-transfer background
// exists at all. Sign-in and password recovery stay centred: they have no
// background worth making room for, and a lone form pinned to one side just
// looks unfinished.
//
// An aligned page sets its own width, since what fits depends on the content —
// a file list wants a narrow column, a photo gallery does not. The layout only
// supplies the vertical centring and which edge to hug.
//
// Cast because this key is our own addition to the route meta rather than one
// Nuxt declares.
const route = useRoute()
const align = computed(() => (route.meta as { align?: string }).align)

const wrapperClass = computed(() => {
  if (align.value === 'left') return 'my-auto'
  // `flex flex-col items-end` rather than `ml-auto` on the card: the page root
  // wraps whichever of the three states is showing, so pushing it from here
  // means each state doesn't have to remember to do it.
  if (align.value === 'right') return 'my-auto flex flex-col items-end'
  return 'm-auto max-w-3xl'
})
</script>

<template>
  <!-- No background colour on this root: Nuxt UI already paints `bg-default` on
       <body>, and an opaque background here would be painted *after* the fixed
       AppBackground layer (which sits at a negative z-index inside the same
       stacking context), hiding the image entirely. -->
  <div class="min-h-screen flex flex-col">
    <!-- Centred on the viewport rather than sitting under a header that no longer
         exists. `m-auto` rather than `justify-center`: with a flex container,
         centring by justification clips the top of anything taller than the
         viewport (the download page with a long file list), while auto margins
         collapse and let it scroll normally. -->
    <main class="flex flex-1 px-4 py-8 sm:px-6 lg:px-10">
      <div
        class="w-full"
        :class="wrapperClass"
      >
        <slot />
      </div>
    </main>

    <footer
      v-if="privacyUrl || imprintUrl"
      class="px-4 sm:px-6 py-6"
    >
      <div class="mx-auto max-w-3xl flex gap-4 text-sm text-muted">
        <ULink
          v-if="imprintUrl"
          :to="imprintUrl"
          target="_blank"
          class="hover:text-default"
        >
          Impressum
        </ULink>
        <ULink
          v-if="privacyUrl"
          :to="privacyUrl"
          target="_blank"
          class="hover:text-default"
        >
          Datenschutz
        </ULink>
      </div>
    </footer>
  </div>
</template>
