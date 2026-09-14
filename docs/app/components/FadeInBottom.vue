<template>
  <div ref="item">
    <!-- The starting state is a class, not an inline style: the child has to be
         shifted and invisible on first paint, before any script has run. -->
    <div
      class="fade-in-bottom"
      :class="{ 'fade-in-bottom--immediate': immediate }"
      :style="immediate ? { '--fade-delay': `${delay}s` } : undefined"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// A short rise and fade the first time an element scrolls into view. Ported
// from LokalBoards, where it carries every FAQ row and the footer.
//
// The styles live in main.css, not in a scoped block here — see the note there.
import { animate, inView } from 'motion-v'

const props = withDefaults(defineProps<{
  /** Seconds to wait once in view — for a block that should arrive after the
      text above it has started, like the buttons under a headline. */
  delay?: number
  /** Plays on first paint, in CSS alone, for a block that is on screen when the
      page loads — rather than waiting for hydration to tell it so. */
  immediate?: boolean
}>(), { delay: 0, immediate: false })

const item = useTemplateRef<HTMLElement>('item')

onMounted(() => {
  if (props.immediate || !item.value) return
  inView(item.value, () => {
    animate(item.value!.children[0]!, { y: 0, opacity: 1 }, { duration: 0.7, delay: props.delay, ease: 'easeOut' })
  })
})
</script>
