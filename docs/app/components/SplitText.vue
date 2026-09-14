<template>
  <component
    :is="as"
    ref="root"
    class="split-text"
    :class="{ 'split-text--revealed': revealed }"
  >
    <!-- The real sentence, once, for anyone not reading the pieces: every piece
         below is hidden from assistive technology and exists only to move. -->
    <span class="sr-only">{{ text }}</span>
    <span
      v-for="(word, wordIndex) in words"
      :key="wordIndex"
      class="split-text__word"
      aria-hidden="true"
    >
      <span
        v-for="(piece, pieceIndex) in word.pieces"
        :key="pieceIndex"
        class="split-text__piece"
        :style="{ transitionDelay: `${piece.delay.toFixed(3)}s` }"
      >{{ piece.text }}</span>
      <span class="split-text__space" />
    </span>
  </component>
</template>

<script setup lang="ts">
// Text revealed as it scrolls into view: each character — or each word, for
// anything longer than a line — rises out of a mask on its word and fades in, a
// few hundredths of a second after the one before. Ported from LokalBoards.
//
// Unlike LokalBoards, every piece is a plain span moved by a CSS transition with
// its own delay, not a Motion component of its own. A paragraph split by word is
// dozens of pieces and the page holds several; a transition does the same
// movement without a component and an animation controller for each one. Motion
// only decides *when*, with one observer per block.
import { useInView } from 'motion-v'

const props = withDefaults(defineProps<{
  text: string
  /** `char` for headlines; `word` is calmer, for paragraphs. */
  by?: 'char' | 'word'
  as?: string
  /** Seconds between one piece starting and the next. */
  stagger?: number
  /** Seconds before the first piece starts. */
  delay?: number
  /** Fraction of the block that has to be in view before it starts. */
  amount?: number
  /** Starts the reveal from outside rather than on the block's own scroll
      position — for blocks that play as one sequence under a shared observer. */
  play?: boolean
}>(), { by: 'char', as: 'span', stagger: undefined, delay: 0, amount: 0.2, play: undefined })

const root = useTemplateRef<HTMLElement>('root')

// The block is observed, never the pieces. A piece starts translated out of its
// word's `overflow: hidden` mask, an IntersectionObserver measures it after that
// clipping, and a piece that is never visible never crosses the threshold.
const inView = useInView(root, { once: true, amount: props.amount })
const revealed = computed(() => props.play ?? inView.value)

const step = computed(() => props.stagger ?? (props.by === 'word' ? 0.02 : 0.03))

// One running index across the whole string, so the cascade carries on across
// word boundaries rather than restarting at each word. Words stay the outer unit
// even by character, so a word never breaks across a line mid-way.
const words = computed(() => {
  let index = 0
  return props.text.split(' ').filter(Boolean).map(word => ({
    pieces: props.by === 'char'
      ? [...word].map(text => ({ text, delay: props.delay + index++ * step.value }))
      : [{ text: word, delay: props.delay + index++ * step.value }]
  }))
})
</script>

<style scoped>
/* The mask each piece rises out of. `overflow: hidden` needs a box, so the word
   is an inline-block; the padding and negative margin together give back the
   descender space (g, y, p) the clip would otherwise cut off. */
.split-text__word {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
  padding-bottom: 0.12em;
  margin-bottom: -0.12em;
}
/* Hidden in the stylesheet rather than by script, so a statically generated page
   never paints the finished text and then snaps it away on hydration. */
.split-text__piece {
  display: inline-block;
  opacity: 0;
  transform: translateY(110%);
  transition:
    transform 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.split-text--revealed .split-text__piece {
  opacity: 1;
  transform: none;
}
/* A real space between words. */
.split-text__space {
  display: inline-block;
  width: 0.25em;
}
.split-text__word:last-child .split-text__space {
  display: none;
}

/* Anyone who has asked for less motion gets the text, immediately, in place. */
@media (prefers-reduced-motion: reduce) {
  .split-text__piece {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
