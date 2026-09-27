<template>
  <div
    ref="root"
    class="curtain"
    :class="{ 'curtain--busy': busy }"
    aria-hidden="true"
  >
    <span
      v-for="layer in LAYERS"
      :key="layer.color"
      class="curtain__panel"
      :style="{ '--curtain': layer.color }"
    />
  </div>
</template>

<script setup lang="ts">
// A curtain wipes across the screen between pages: it sweeps in over the page
// being left, the swap happens while the screen is covered, and it sweeps on
// and off the far side to hand over the new one. Chesstics does the same thing
// with Motion+'s `curtains()`; this is the same handshake with the router, with
// the shape drawn here rather than by the paid package.
//
// The shape is the interesting half of it and it is only a clip path: a vertical
// edge bowed into a quadratic curve, whose middle runs `BOW` of the viewport
// ahead of its ends, so the wipe reads as a sweep rather than a rectangle
// sliding past. Both halves share that one travelling edge — covering paints
// what is behind it, revealing paints what is ahead of it — so the curtain
// never reverses: it keeps going the same way all the way across.
import { START_LOCATION } from 'vue-router'
import { animate, useMotionValue, useReducedMotion } from 'motion-v'

/** Two panels in the two reds, one a beat behind the other, in paint order:
    the second is painted over the first. Which of them leads is the phase's
    business — whoever is underneath has to be the one out in front, or it
    spends the whole wipe hidden behind the other. */
const LAYERS = [
  { color: 'var(--color-primary-hover)', lead: 0 },
  { color: 'var(--color-primary)', lead: 0.06 }
]

/** How far the middle of the edge runs ahead of its ends, in viewport widths. */
const BOW = 0.16
/** Pixels of overshoot at each end, so neither turn leaves a seam of colour. */
const SLACK = 2
/** Going in it gathers speed, coming out it eases off: together the two halves
    read as one sweep that accelerates through the swap. */
const COVER = { duration: 0.38, ease: [0.5, 0, 0.55, 0.25] as Ease }
const REVEAL = { duration: 0.46, ease: [0.28, 0.9, 0.35, 1] as Ease }
/** However a navigation ends, the screen is uncovered within this long. */
const FALLBACK = 2500
/** Grace on top of a wipe's own length before it is given up on, for a frame
    that comes late — or, in a background tab, never. */
const SLOW = 400

type Ease = [number, number, number, number]
type Phase = 'cover' | 'reveal'

const root = useTemplateRef<HTMLElement>('root')
const busy = ref(false)
const { open } = useCurtain()
const reduced = useReducedMotion()

// One progress value per panel, each writing its own panel's clip path. They
// are motion values rather than refs: the shape is set straight on the element
// every frame, with no render in between.
const progress = LAYERS.map(() => useMotionValue(0))

let phase: Phase = 'cover'
let geometry = { w: 0, h: 0, b: 0 }

/** The clip path at `t`: the travelling edge, from just off the near side to
    just past the far side, with everything behind or ahead of it filled. */
function shape(t: number) {
  const { w, h, b } = geometry
  const x = Math.round((-b - SLACK + t * (w + b + SLACK * 2)) * 10) / 10
  // A quadratic whose control point sits twice the bow out puts the middle of
  // the curve exactly one bow ahead of its two ends.
  const edge = `${x} 0 Q ${x + 2 * b} ${h / 2} ${x} ${h}`
  return phase === 'cover'
    ? `path("M 0 0 L ${edge} L 0 ${h} Z")`
    : `path("M ${edge} L ${w} ${h} L ${w} 0 Z")`
}

/** Sweeps the edge all the way across, once, filling the given side of it.
    Always settles: a tab in the background gets no animation frames at all, and
    neither half can be allowed to hold up a navigation waiting for one. */
function run(next: Phase) {
  // Queried rather than collected by a template ref, which Vue does not promise
  // to hand back in document order — and here paint order is the whole point.
  const panels = root.value?.querySelectorAll<HTMLElement>('.curtain__panel')
  if (!panels?.length) return Promise.resolve([])

  const rect = root.value!.getBoundingClientRect()
  geometry = { w: rect.width, h: rect.height, b: rect.width * BOW }
  phase = next

  // The starting shape is painted before the curtain is allowed to show, or its
  // first frame would be an unclipped panel filling the screen.
  for (const value of progress) value.set(0)
  busy.value = true

  const options = next === 'cover' ? COVER : REVEAL
  const last = Math.max(...LAYERS.map(layer => layer.lead))
  const controls = LAYERS.map((layer, i) => animate(progress[i]!, 1, {
    ...options,
    // Covering, the panel underneath goes first and the one on top follows it
    // in; revealing, the one on top leaves first and uncovers the other. Either
    // way both edges are on screen and the wipe carries both colours.
    delay: next === 'cover' ? layer.lead : last - layer.lead
  }))

  // Stopping an animation rejects the promise it handed out, so both ends of
  // the race are swallowed — the caller only needs to know the wipe is over.
  const played = Promise.all(controls.map(control => control.finished)).catch(() => {})
  const giveUp = new Promise<void>(resolve => setTimeout(resolve, (options.duration + last) * 1000 + SLOW))
    .then(() => { for (const control of controls) control.stop() })

  return Promise.race([played, giveUp])
}

/** One animation frame — or 100ms, since a background tab gets no frames at all
    and a curtain waiting on one would still be down when the tab came back. */
function frame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
    setTimeout(resolve, 100)
  })
}

/** Resolves once the page navigated to is mounted and its scroll position has
    been put back — both of which happen behind the cover. A navigation that
    fails after the guard let it through renders nothing, so it ends the wait
    too, and a timeout makes sure the curtain can never stay down. */
function whenPageIsUp(nuxtApp: ReturnType<typeof useNuxtApp>, router: ReturnType<typeof useRouter>) {
  return new Promise<void>((resolve) => {
    let settled = false

    const finish = async () => {
      if (settled) return
      settled = true
      off()
      stopFailure()
      clearTimeout(timer)
      // Nuxt puts the scroll back one frame after this hook, so waiting two
      // frames past it means the page is never seen jumping to the top.
      await frame()
      await frame()
      resolve()
    }

    const off = nuxtApp.hooks.hookOnce('page:loading:end', finish)
    const stopFailure = router.afterEach((_to, _from, failure) => {
      if (failure) finish()
    })
    const timer = setTimeout(finish, FALLBACK)
  })
}

onMounted(() => {
  const nuxtApp = useNuxtApp()
  const router = useRouter()
  const panels = [...root.value!.querySelectorAll<HTMLElement>('.curtain__panel')]

  // Each panel follows its own progress value for as long as the app is up.
  const unwatch = progress.map((value, i) =>
    value.on('change', (t: number) => { panels[i]!.style.clipPath = shape(t) }))

  // Counts navigations, so a reveal belonging to a page already left behind
  // knows to stand down.
  let ticket = 0

  const stop = router.beforeResolve(async (to, from) => {
    // Nothing to wipe on the first render, on a hash or query change, or for
    // anyone who has asked for less movement.
    if (reduced.value || from === START_LOCATION || to.path === from.path) return

    const mine = ++ticket
    // Waiting here is what holds the swap back until the screen is covered. A
    // second navigation inside the first finds it covered already.
    if (!busy.value) {
      await run('cover')
      // Covered. The page that mounts behind this must not spend its reveals
      // where nobody can see them — see `useCurtain`.
      open.value = false
      document.documentElement.dataset.curtain = 'down'
    }

    whenPageIsUp(nuxtApp, router).then(async () => {
      if (mine !== ticket) return // a newer navigation owns the curtain now
      // The new page starts moving as the curtain sweeps off, not after it.
      open.value = true
      delete document.documentElement.dataset.curtain
      if (!busy.value) return
      await run('reveal')
      busy.value = false
    })
  })

  onUnmounted(() => {
    stop()
    for (const off of unwatch) off()
    delete document.documentElement.dataset.curtain
  })
})
</script>

<style scoped>
.curtain {
  position: fixed;
  inset: 0;
  z-index: 60;
  /* Idle it is not painted at all, and never in the way of a click. */
  visibility: hidden;
  pointer-events: none;
}
.curtain--busy {
  visibility: visible;
  /* Swallows clicks for the half second the screen is covered, so a second
     link cannot start a navigation inside this one. */
  pointer-events: auto;
}
.curtain__panel {
  position: absolute;
  inset: 0;
  display: block;
  background: var(--curtain, var(--color-primary));
  /* Clipped to nothing until a wipe gives it a shape. */
  clip-path: inset(0 100% 0 0);
}
.curtain--busy .curtain__panel {
  will-change: clip-path;
}
</style>
