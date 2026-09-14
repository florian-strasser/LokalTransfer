<template>
  <span
    class="inline-flex flex-row-reverse tabular-nums"
    :aria-label="String(value)"
  >
    <AnimatePresence :initial="false">
      <!-- The columns come and go with the length of the figure, so the number
           is only ever as wide as its digits — a reserved-but-empty column would
           push a single digit off the centre of the ring. -->
      <Motion
        v-for="slot in count"
        :key="slot"
        as="span"
        class="relative inline-block overflow-hidden"
        style="height: 1.1em"
        aria-hidden="true"
        :initial="{ width: 0, opacity: 0 }"
        :animate="{ width: SLOT_WIDTH, opacity: 1 }"
        :exit="{ width: 0, opacity: 0 }"
        :transition="TRANSITION"
      >
        <AnimatePresence :initial="false">
          <Motion
            :key="charAt(slot)"
            as="span"
            class="absolute inset-0 flex items-center justify-center"
            :initial="{ y: enterFrom, opacity: 0 }"
            :animate="{ y: '0%', opacity: 1 }"
            :exit="{ y: exitTo, opacity: 0 }"
            :transition="TRANSITION"
          >{{ charAt(slot) }}</Motion>
        </AnimatePresence>
      </Motion>
    </AnimatePresence>
  </span>
</template>

<script setup lang="ts">
// A number whose digits slide when they change, and whose columns come and go
// with the length of the figure.
//
// Columns are counted from the right so the ones column stays the ones column as
// the number gains or loses a digit — keyed left to right, 9 → 10 would slide
// every digit rather than just introducing the tens.
//
// The digits are `aria-hidden` and the whole carries the value as its label: a
// screen reader should hear "87", not the separate characters that happen to be
// on screen mid-transition.
const props = withDefaults(defineProps<{
  value: number
  /** Columns to hold open even when the figure is shorter. Left at one, the
      number takes exactly the width of its digits. */
  minSlots?: number
  /** Which way digits travel. Rising numbers read as digits climbing. */
  direction?: 'up' | 'down'
}>(), { minSlots: 1, direction: 'up' })

const enterFrom = computed(() => (props.direction === 'down' ? '-110%' : '110%'))
const exitTo = computed(() => (props.direction === 'down' ? '110%' : '-110%'))

// One tabular figure. Animated rather than fixed, so a retiring column carries
// its digit out instead of the digit vanishing as the box snaps to a new width.
const SLOT_WIDTH = '1ch'

// Stiff and well damped: a figure that wobbled would read as an estimate.
const TRANSITION = { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.7 }

const text = computed(() => String(Math.max(0, Math.round(props.value))))
const count = computed(() => Math.max(props.minSlots, text.value.length))

/** The character in a column, counting 1 from the right. */
function charAt(slot: number): string {
  const index = text.value.length - slot
  return index >= 0 ? text.value[index]! : ''
}
</script>
