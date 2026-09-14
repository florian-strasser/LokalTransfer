<template>
  <span class="anum">
    <AnimatePresence :initial="false">
      <!-- The columns themselves come and go, so the number is only ever as wide
           as the figure it is showing. A reserved-but-empty column would push a
           single digit off the centre of whatever is centring it. -->
      <Motion
        v-for="slot in count"
        :key="slot"
        as="span"
        class="anum__slot"
        :initial="{ width: 0, opacity: 0 }"
        :animate="{ width: SLOT_WIDTH, opacity: 1 }"
        :exit="{ width: 0, opacity: 0 }"
        :transition="TRANSITION"
      >
        <AnimatePresence :initial="false">
          <Motion
            :key="charAt(slot)"
            as="span"
            class="anum__digit"
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
// Motion's own `AnimateNumber` does all of this, but it is a Motion+ component
// and ships in no published version of `motion-v`.
const props = withDefaults(defineProps<{
  value: number
  /** Columns to hold open even when the figure is shorter. Left at one, the
      number takes exactly the width of its digits, which is what lets a single
      digit sit centred. */
  minSlots?: number
  /** Which way digits travel. Rising numbers read as digits climbing. */
  direction?: 'up' | 'down'
}>(), { minSlots: 1, direction: 'up' })

const enterFrom = computed(() => (props.direction === 'down' ? '-110%' : '110%'))
const exitTo = computed(() => (props.direction === 'down' ? '110%' : '-110%'))

// One tabular figure. Animated rather than fixed, so a column that retires
// carries its digit out with it instead of the digit vanishing as the box snaps
// to its new width.
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

<style scoped>
.anum {
  display: inline-flex;
  /* Right to left, so column 1 (the ones) sits at the right-hand end. */
  flex-direction: row-reverse;
  font-variant-numeric: tabular-nums;
}
.anum__slot {
  position: relative;
  display: inline-block;
  height: 1.25em;
  overflow: hidden;
}
.anum__digit {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Someone who asked for less motion gets the figure, not the slide. */
@media (prefers-reduced-motion: reduce) {
  .anum__digit {
    transform: none !important;
  }
}
</style>
