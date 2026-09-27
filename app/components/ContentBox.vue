<script setup lang="ts">
// A tile on the grey page — LokalBoards' ContentBox, with the header slot and
// the lift the signed-in pages already had. Every tile gets the same shadow, so
// a new one can't miss it.
//
// `translucent` is for a tile floating over the background photograph (the
// sign-in card): it lets a little of the picture through, blurred.
withDefaults(defineProps<{
  bodyClass?: string
  translucent?: boolean
}>(), { bodyClass: 'p-4 sm:p-6', translucent: false })
</script>

<template>
  <div
    class="rounded-lg shadow-xl ring-1 ring-default divide-y divide-default"
    :class="translucent ? 'bg-default/90 backdrop-blur-md' : 'bg-default'"
  >
    <div
      v-if="$slots.header"
      class="p-4 sm:px-6"
    >
      <slot name="header" />
    </div>
    <div :class="bodyClass">
      <slot />
    </div>
  </div>
</template>
