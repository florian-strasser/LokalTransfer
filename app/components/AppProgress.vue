<template>
  <div
    class="w-full overflow-hidden rounded-full bg-accented"
    :class="size === 'xs' ? 'h-0.5' : 'h-2'"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="value"
  >
    <Motion
      class="h-full rounded-full bg-primary"
      :style="{ width }"
    />
  </div>
</template>

<script setup lang="ts">
// The upload progress bar: a fill that springs to each reading rather than
// creeping to it.
//
// Upload progress does not arrive continuously — it arrives per chunk of the
// stream, several times a second — so the honest thing to draw is a bar that
// jumps to what it was told and settles, which is what a spring gives. A linear
// tween between chunks would be inventing readings the transfer never reported.
// This is Motion's Radix progress example applied to the app's own bar.
//
// It fills by *width*, where that example translates the indicator. The two look
// the same and the difference matters: `UProgress` slid a full-width indicator
// into place with `translateX`, which put the element hundreds of pixels outside
// its own track with only `overflow: hidden` holding it in — and WebKit does not
// reliably clip a transformed descendant when an ancestor carries a
// `backdrop-filter`, which the composer card does. The bar ran out across the
// card. Nothing here ever leaves the track, so there is nothing to clip.
import { useMotionTemplate, useMotionValue, useSpring } from 'motion-v'

const props = withDefaults(
  defineProps<{ modelValue: number, size?: 'xs' | 'md' }>(),
  { size: 'md' }
)

// Clamped, because a value outside 0–100 would be exactly the overflow this
// component exists to make impossible.
const value = computed(() => {
  const n = Math.round(Number(props.modelValue))
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
})

// `useSpring` follows a MotionValue, not a Vue ref — handed a computed it reads
// it once and never hears about a change again, which is a bar that renders the
// first reading and then sits there.
const target = useMotionValue(value.value)

// Stiff and well damped: it arrives quickly and settles without a wobble. A
// progress bar that bounced past its reading would look like a guess.
const spring = useSpring(target, { stiffness: 260, damping: 30, mass: 0.6 })

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
const width = useMotionTemplate`${spring}%`
</script>
