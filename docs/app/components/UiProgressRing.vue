<template>
  <div
    class="pring"
    :style="{ '--size': `${size}px` }"
  >
    <svg
      :viewBox="`0 0 ${size} ${size}`"
      class="pring__svg"
      aria-hidden="true"
    >
      <circle
        :cx="centre"
        :cy="centre"
        :r="radius"
        fill="none"
        :stroke-width="stroke"
        class="pring__track"
      />
      <!-- One circle whose dash pattern is its whole circumference, offset back
           by however much is still to go — so the arc is drawn along the track
           rather than being a second shape kept in register with it. -->
      <Motion
        as="circle"
        :cx="centre"
        :cy="centre"
        :r="radius"
        fill="none"
        :stroke-width="stroke"
        stroke-linecap="round"
        class="pring__arc"
        :style="{ strokeDasharray: circumference, strokeDashoffset: offset }"
      />
    </svg>

    <span class="pring__value">
      <AnimatedNumber
        :value="clamped"
        direction="up"
      />
      <span class="pring__pct">%</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { useMotionValue, useSpring, useTransform } from 'motion-v'

const props = withDefaults(
  defineProps<{ value: number, size?: number, stroke?: number }>(),
  { size: 96, stroke: 8 }
)

const clamped = computed(() => Math.min(100, Math.max(0, Math.round(props.value) || 0)))

// Inset by half the stroke, or the arc is clipped by the viewBox where it is
// thickest.
const centre = computed(() => props.size / 2)
const radius = computed(() => props.size / 2 - props.stroke / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

// `useSpring` follows a MotionValue, not a Vue ref — handed a computed it reads
// it once and never hears about a change again.
const target = useMotionValue(clamped.value)
const spring = useSpring(target, { stiffness: 160, damping: 26, mass: 0.8 })

// Backwards is a restart, not progress. A reading only drops when a new transfer
// has begun, and easing the arc back down reads as progress being lost —
// so a decrease snaps and only an increase springs. Both values have to jump:
// the target, and the spring's own current position.
watch(clamped, (v, previous) => {
  if (v < previous) {
    target.jump(v)
    spring.jump(v)
  } else {
    target.set(v)
  }
})
const offset = useTransform(spring, v => circumference.value * (1 - v / 100))
</script>

<style scoped>
/* Not `.ring`: Tailwind generates a `ring` utility that paints a 1px box-shadow
   in `currentcolor` when no ring colour is set, and a block class of that name
   collides with it. It drew a dark square around the circle in Safari while
   resolving to transparent in Chrome, so it was invisible here and obvious
   there.

   Tailwind's scanner is plain text, so the utility is still emitted from the
   word appearing in prose here and elsewhere. That is harmless — it is one
   unused rule, and no element carries the class. What mattered was the name
   collision, not the rule's existence. */
.pring {
  position: relative;
  width: var(--size);
  height: var(--size);
}
.pring__svg {
  width: 100%;
  height: 100%;
  /* Start the arc at twelve o'clock rather than three. */
  transform: rotate(-90deg);
}
.pring__track {
  stroke: color-mix(in oklab, var(--color-dark) 12%, transparent);
}
.pring__arc {
  stroke: var(--color-primary);
}
.pring__value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--size) / 4);
  font-weight: 600;
  color: var(--color-dark);
}
.pring__pct {
  font-size: 0.55em;
  margin-left: 0.1em;
  color: var(--color-gray);
}
</style>
