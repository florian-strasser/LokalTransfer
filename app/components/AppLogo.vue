<script setup lang="ts">
// The LokalTransfer mark: three circles of increasing size, the leading one
// solid and the two behind it at 66% and 33% — the same opacity ladder as the
// LokalBoards mark, so the two brands read as siblings.
//
// The two trailing circles are *crescents*, not whole circles: each one has the
// shape in front of it knocked out. That matters. Drawn as full circles, the
// overlap of 33% under 66% would composite to 77% and the mark would show four
// tones instead of three, muddying exactly the effect the ladder is for.
//
// `currentColor` throughout, so the mark takes the colour of whatever it sits
// in — `text-primary` in the header, or the inherited text colour elsewhere.
// The favicon can't inherit anything, so it is generated separately with an
// explicit fill (see server/utils/favicon.ts).
withDefaults(defineProps<{
  /** Accessible name. Empty (the default) marks it decorative, for use next to a wordmark. */
  title?: string
}>(), { title: '' })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 401 261"
    fill="currentColor"
    :role="title ? 'img' : 'presentation'"
    :aria-hidden="title ? undefined : 'true'"
  >
    <title v-if="title">{{ title }}</title>
    <path
      d="M63.897,178.539C59.485,179.816 54.821,180.5 50,180.5C22.404,180.5 0,158.095 0,130.5C0,102.904 22.404,80.5 50,80.5C54.821,80.5 59.485,81.183 63.897,82.46C55.096,96.364 50,112.841 50,130.5C50,148.158 55.096,164.635 63.897,178.539Z"
      fill-opacity="0.33"
    />
    <path
      d="M171.068,214.985C161.383,218.552 150.917,220.5 140,220.5C90.328,220.5 50,180.173 50,130.5C50,80.828 90.328,40.5 140,40.5C150.917,40.5 161.383,42.449 171.068,46.016C151.696,68.788 140,98.289 140,130.5C140,162.711 151.696,192.213 171.068,214.985Z"
      fill-opacity="0.66"
    />
    <circle
      cx="270.5"
      cy="130.5"
      r="130.5"
    />
  </svg>
</template>
