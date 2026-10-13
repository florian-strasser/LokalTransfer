<script setup lang="ts">
import { animate } from 'motion-v'
import { Check, TriangleAlert } from '@lucide/vue'
import type { ToastInput } from '~/composables/useNotify'

// LokalBoards' toast stack, with a title and a description where LokalBoards
// has one line, and the success/failure treatment from useNotify.
//
// A plain stack: every toast is its own card, oldest at the top and newest
// nearest the corner. No collapsing and no measuring — several toasts at once
// is rare enough that a straight column is the right amount of machinery. The
// container ignores pointer events so the gaps between cards cannot swallow
// clicks on whatever is underneath.
type Toast = ToastInput & { id: number }
type Clock = ReturnType<typeof animate>

const nuxtApp = useNuxtApp()
const toasts = ref<Toast[]>([])
const clocks = new Map<number, Clock>()
let nextId = 1

function remove(id: number) {
  clocks.get(id)?.stop()
  clocks.delete(id)
  toasts.value = toasts.value.filter(toast => toast.id !== id)
}

// The ring is the countdown: it closes as the toast runs out, and it is the
// same clock that dismisses it, so the picture and the dismissal cannot drift
// apart. It starts the moment its element exists rather than on a timer of its
// own.
function setRing(toast: Toast, el: unknown) {
  if (!(el instanceof SVGCircleElement) || clocks.has(toast.id)) return

  const clock = animate(el, { pathLength: [0, 1] }, { duration: toast.seconds, ease: 'linear' })
  clocks.set(toast.id, clock)
  clock.finished.then(() => remove(toast.id)).catch(() => {
    // Stopped on unmount.
  })
}

// Two of the same message make two cards: they are two things that happened.
nuxtApp.hook('app:toast', (toast) => {
  toasts.value = [...toasts.value, { ...toast, id: nextId++ }]
})

// Reading takes longer than five seconds sometimes — especially an error with a
// URL in it. The pointer stops every clock, not only the one beneath it, so the
// stack cannot rearrange itself while a message is being read.
const hold = () => clocks.forEach(clock => clock.pause())
const release = () => clocks.forEach(clock => clock.play())

onBeforeUnmount(() => clocks.forEach(clock => clock.stop()))
</script>

<template>
  <TransitionGroup
    name="toast"
    tag="div"
    role="status"
    aria-live="polite"
    class="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-y-2 sm:inset-x-auto sm:bottom-8 sm:right-8"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto w-full max-w-sm rounded-xl bg-default px-5 py-3 shadow-lg ring-1 ring-default"
      @mouseenter="hold"
      @mouseleave="release"
    >
      <div class="flex items-start gap-x-3">
        <div
          class="relative size-6 shrink-0"
          :class="toast.tone === 'error' ? 'text-primary' : 'text-highlighted'"
        >
          <!-- `pathLength="1"` normalises the circumference so the animation
               runs 0 → 1 whatever the radius; `stroke-dasharray="0 1"` keeps it
               invisible for the frame before Motion takes the element over. -->
          <svg
            class="absolute inset-0 size-6 -rotate-90"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              opacity="0.2"
            />
            <circle
              :ref="(el: unknown) => setRing(toast, el)"
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              pathLength="1"
              stroke-dasharray="0 1"
            />
          </svg>
          <component
            :is="toast.tone === 'error' ? TriangleAlert : Check"
            class="absolute inset-0 m-auto size-3.5"
            aria-hidden="true"
          />
        </div>
        <div class="min-w-0 grow pt-0.5 text-sm">
          <p class="font-medium text-highlighted">
            {{ toast.title }}
          </p>
          <p
            v-if="toast.description"
            class="text-muted"
          >
            {{ toast.description }}
          </p>
        </div>
      </div>
    </div>
  </TransitionGroup>
</template>
