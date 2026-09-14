<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('compose.title') })

// Set once the composer swaps its form for the result card.
const sent = ref(false)
</script>

<template>
  <div>
    <!-- The instance's own background, with no `src` — a transfer's own image
         belongs to its download page, not to the form that produced it.
         Unwashed, like the download page: this page and that one are the same
         composition with different content in the card, and a sender who
         configured a photograph should see the photograph.
         Nothing sits outside the card any more, so there is no loose text left
         for a scrim to protect — the heading moved inside it. -->
    <AppBackground :scrim="false" />

    <!-- Against the left edge of the layout's container, so the card lines up
         under the logo and leaves the rest of the viewport to the image — the
         download page's composition, and the reason a background exists at all.

         The 14rem is arithmetic, not a guess. The card's box starts 7rem down
         (the layout's 5rem header plus its 2rem of top padding), so for the box
         to be centred on the middle of the screen its height has to be
         2 × (50svh − 7rem) — which is 100svh − 14rem.

         `my-auto` on the inner block rather than `justify-center` here: auto
         margins collapse when the form is taller than the viewport and let it
         scroll normally, where centring by justification would clip its top. -->
    <div class="flex min-h-[calc(100svh-14rem)] max-w-md flex-col">
      <div class="my-auto">
        <TransferComposer
          mode="member"
          :title="sent ? undefined : t('compose.title')"
          @update:sent="sent = $event"
        />
      </div>
    </div>
  </div>
</template>
