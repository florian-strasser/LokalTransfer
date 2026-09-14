<template>
  <!-- Lenis in `root` mode drives the window's own scroll, so this wrapper adds
       no scroll container of its own — it only exists to mount the instance.
       `anchors` keeps in-page links working under it; `stopInertiaOnNavigate`
       stops a fling carrying over into the next page. Same settings as
       LokalBoards, so the two sites scroll alike. -->
  <div class="flex grow flex-col">
    <VueLenis
      root
      :options="{
        autoRaf: true,
        anchors: true,
        allowNestedScroll: true,
        stopInertiaOnNavigate: true
      }"
    >
      <slot />
    </VueLenis>
  </div>
</template>

<script setup lang="ts">
import { VueLenis } from 'lenis/vue'
</script>
