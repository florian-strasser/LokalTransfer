<template>
  <div ref="item">
    <!-- The starting state is a class, not an inline style: the child has to be
         shifted and invisible on first paint, before any script has run. -->
    <div class="fade-in-bottom">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// A short rise and fade the first time an element scrolls into view. Ported
// from LokalBoards, where it carries every FAQ row and the footer.
import { animate, inView } from 'motion-v'

// Seconds to wait once in view — for a block that should arrive after the text
// above it has started, like the buttons under a headline.
const props = withDefaults(defineProps<{ delay?: number }>(), { delay: 0 })

const item = useTemplateRef<HTMLElement>('item')

onMounted(() => {
  if (!item.value) return
  inView(item.value, () => {
    animate(item.value!.children[0]!, { y: 0, opacity: 1 }, { duration: 0.7, delay: props.delay, ease: 'easeOut' })
  })
})
</script>

<style scoped>
.fade-in-bottom {
  /* The wrapper's full height, so a block that stretches — a feature tile in a
     grid row — still stretches with this in between. Under a wrapper of auto
     height it resolves to auto and changes nothing. */
  height: 100%;
  opacity: 0;
  transform: translateY(4rem);
}
@media (prefers-reduced-motion: reduce) {
  .fade-in-bottom {
    opacity: 1;
    transform: none;
  }
}
</style>
