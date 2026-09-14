<template>
  <component
    :is="as"
    ref="root"
    class="split-text"
    :class="{ 'split-text--revealed': revealed, 'split-text--immediate': immediate }"
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
        :style="{ '--piece-delay': `${piece.delay.toFixed(3)}s` }"
      >{{ piece.text }}</span>
    </span>
  </component>
</template>

<script setup lang="ts">
// Text revealed as it scrolls into view: each character — or each word, for
// anything longer than a line — rises out of a mask on its word and fades in, a
// few hundredths of a second after the one before. Ported from LokalBoards.
//
// Every piece is a plain span moved by CSS with its own delay, not a Motion
// component of its own. A paragraph split by word is dozens of pieces and the page
// holds several; CSS does the same movement without a component and an animation
// controller for each one. Motion only decides *when*, with one observer per block.
//
// The styles live in main.css, not in a scoped block here — see the note there.
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
  /** Plays on first paint, in CSS alone, for text that is on screen when the page
      loads. Waiting for an observer means waiting for hydration, and the headline
      stayed invisible until the JavaScript had run — which is most of what the
      page's Largest Contentful Paint was measuring. */
  immediate?: boolean
}>(), { by: 'char', as: 'span', stagger: undefined, delay: 0, amount: 0.2, play: undefined, immediate: false })

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
