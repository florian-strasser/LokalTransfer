<template>
  <div
    class="relative"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="value"
  >
    <svg
      :viewBox="`0 0 ${size} ${size}`"
      class="size-full -rotate-90"
      aria-hidden="true"
    >
      <!-- The track the arc runs on. Drawn first and full circle, so the arc
           always has something underneath it to be a fraction of. -->
      <circle
        :cx="centre"
        :cy="centre"
        :r="radius"
        fill="none"
        :stroke-width="stroke"
        stroke="currentColor"
        class="text-accented"
      />
      <!-- The arc. One circle with its dash pattern set to the full
           circumference, offset back by however much is still to go — so the
           stroke is drawn along the track rather than being a second shape that
           has to be kept in register with it. -->
      <Motion
        as="circle"
        :cx="centre"
        :cy="centre"
        :r="radius"
        fill="none"
        :stroke-width="stroke"
        stroke="currentColor"
        stroke-linecap="round"
        class="text-primary"
        :style="{ strokeDasharray: circumference, strokeDashoffset: offset }"
      />
    </svg>

    <div class="absolute inset-0 flex items-center justify-center">
      <span
        class="flex items-baseline font-semibold tracking-tight text-highlighted"
        :style="{ fontSize: `${size / 4}px` }"
      >
        <AppAnimatedNumber
          :value="value"
          direction="up"
        />
        <span class="ml-0.5 text-[0.5em] text-muted">%</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// The upload's overall progress, as a ring.
//
// A ring rather than a bar because this is the one figure worth looking at while
// a transfer runs — it is the whole state of the operation, not a detail of it —
// and it springs to each reading rather than easing between them: progress
// arrives per chunk of the stream, so a smooth tween would be drawing readings
// the upload never reported.
import { useMotionValue, useSpring, useTransform } from 'motion-v'

const props = withDefaults(
  defineProps<{ modelValue: number, size?: number, stroke?: number }>(),
  { size: 132, stroke: 10 }
)

// Clamped: a value outside 0–100 would draw an arc longer than its own track.
const value = computed(() => {
  const n = Math.round(Number(props.modelValue))
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
})

// Inset by half the stroke, or the arc is clipped by the viewBox at its
// thickest point.
const centre = computed(() => props.size / 2)
const radius = computed(() => props.size / 2 - props.stroke / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

// `useSpring` follows a MotionValue, not a Vue ref — handed a computed it reads
// it once and never hears about a change again.
const target = useMotionValue(value.value)
const spring = useSpring(target, { stiffness: 160, damping: 26, mass: 0.8 })

// Backwards is a restart, not progress. A reading only drops when a new transfer
// has begun, and easing a ring or a bar back down reads as progress being lost —
// so a decrease snaps and only an increase springs. Both values have to jump:
// the target, and the spring's own current position.
watch(value, (v, previous) => {
  if (v < previous) {
    target.jump(v)
    spring.jump(v)
  } else {
    target.set(v)
  }
})
const offset = useTransform(spring, v => circumference.value * (1 - v / 100))
</script>
