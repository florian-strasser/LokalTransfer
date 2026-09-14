<template>
  <!-- The app's own mark: three circles at full, two-thirds and one-third
       opacity — the same construction LokalBoards uses, so the family reads as
       a family. `currentColor` so one component serves the header, the footer
       and anywhere else, taking the colour of whatever it sits in. -->
  <svg
    viewBox="0 0 64 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="title"
  >
    <title>{{ title }}</title>
    <circle
      cx="14"
      cy="20"
      r="12"
      fill="currentColor"
      opacity="0.33"
    />
    <circle
      cx="27"
      cy="20"
      r="14"
      fill="currentColor"
      opacity="0.66"
    />
    <circle
      cx="44"
      cy="20"
      r="16"
      fill="currentColor"
    />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'LokalTransfer' })
</script>
