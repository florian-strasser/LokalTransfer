<template>
  <!-- The tile arrives whole, rising in as it comes into view. Its heading and
       copy are part of that block rather than revealed piece by piece: inside a
       card that is itself moving, a second cascade would be one too many. -->
  <FadeInBottom>
    <div class="flex h-full flex-col rounded-2xl border border-slate bg-slate/50 p-6">
      <!-- The demo sits above the words on purpose: the point of this section is
         that you see the thing before you read what it is. -->
      <div
        v-if="$slots.visual"
        class="feature-tile__visual"
      >
        <slot name="visual" />
      </div>

      <h3 class="text-base font-semibold text-dark">
        {{ title }}
      </h3>
      <p class="mt-2 text-[15px] leading-relaxed">
        <slot />
      </p>
    </div>
  </FadeInBottom>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<style scoped>
/* One height for every visual, so tiles of different content still line their
   headings up across a row. The fragment inside is centred in it rather than
   stretched: these are drawings at a fixed aspect, and stretching one to fill
   would distort the interface it is imitating.

   10rem is the tallest fragment — the password prompt, 157px — and no more, so
   the wrapper adds no band of empty space above and below the illustrations.
   Fragments that could outgrow it (the flag, the gallery) are sized to fit it.
   A minimum rather than a height: on a phone the upload-and-expiry tile stacks
   its two panels and needs more, and in one column there is no row to align. */
.feature-tile__visual {
  display: grid;
  align-content: center;
  min-height: 10rem;
  margin-bottom: 1.25rem;
}
</style>
