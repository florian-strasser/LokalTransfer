<template>
  <!-- A slow, endless stream of photographs rising past the headline — a
       transfer's worth of pictures, moving the way a transfer does.

       Each one arrives small and transparent from below the buttons, grows and
       solidifies as it climbs past the copy, and shrinks and fades away again
       above it. There is no clipping on this band at all: opacity alone brings a
       card in and takes it out, so it is never seen cut by an edge. -->
  <Motion
    as="div"
    class="cards"
    aria-hidden="true"
    :style="{ opacity, visibility }"
  >
    <div
      v-for="slot in slots"
      :key="slot.key"
      class="cards__card"
      :class="[`cards__card--${slot.side}`, { 'cards__card--echo': slot.echo }]"
      :style="{
        '--delay': `${-slot.launch}s`,
        '--rot': `${slot.lane.rotate}deg`,
        '--rest': slot.rest,
        '--w': slot.lane.width,
        'zIndex': slot.lane.z,
        ...slot.anchor
      }"
    >
      <img
        :src="`/images/hero/${slot.src}.webp`"
        :srcset="`/images/hero/${slot.src}-160.webp 160w, /images/hero/${slot.src}-320.webp 320w, /images/hero/${slot.src}.webp 640w`"
        sizes="(max-width: 39.99rem) 5rem, (max-width: 63.99rem) 6rem, (min-width: 80rem) 16rem, 14vw"
        alt=""
        width="640"
        height="640"
        loading="eager"
        decoding="async"
        class="cards__photo"
      >
    </div>
  </Motion>
</template>

<script setup lang="ts">
import { useMotionValue, useTransform, type MotionValue } from 'motion-v'

// How visible the whole stream is, handed down by the hero, which fades it out
// as the product screenshot below grows to full size. It multiplies with each
// card's own fade, and it has to sit on this root rather than on a wrapper: the
// root is already its own stacking context (absolute, z-index -1), so opacity
// changes nothing about what paints over what — whereas a static wrapper would
// become a new stacking context below 1 and lift the cards over the headline.
// Without the prop, the stream is simply always there.
const props = defineProps<{ fade?: MotionValue<number> }>()
const opacity = props.fade ?? useMotionValue(1)

// Fully faded is hidden outright, so sixteen invisible layers are not still being
// composited while the reader is further down the page.
const visibility = useTransform(opacity, v => (v <= 0 ? 'hidden' : 'visible'))

// The stream is a planned circuit, not eight cards each on their own loop.
//
// One master cycle of CYCLE seconds, a launch every PACE seconds, sides
// strictly alternating: left, right, left, right. Every photograph appears
// twice — once from each side, in a different lane each time. Its left launch
// is at 10i seconds; its right launch is 35 seconds later. Not 40: with the
// sides alternating every five seconds, a slot 40 seconds on is on the *same*
// side, and no pairing of the sixteen slots can put every photograph on both
// sides and keep the sides alternating unless the pairing distance is odd in
// slots. 35 seconds is seven slots, and it maps the eight left launches onto
// the eight right ones exactly once each.
//
// Two guarantees follow, and the numbers are chosen to hold them:
//   - A photograph is never on screen twice. Its launches are 35 seconds apart
//     (45 the other way round the cycle) and a pass lasts 28, so the first has
//     faded out seven seconds before the second begins.
//   - Two cards never share a lane at once. A side launches every 10 seconds
//     and rotates through its four lanes, so the same lane comes round every
//     40 seconds — well clear of a 28-second pass. The earlier draft flipped
//     sides at the half-cycle, which put two launches on one side five seconds
//     apart at the wrap, in the same lane: that was the chef stacked on the
//     turtle.
// Keep the keyframe percentages in the style block in step with these.
const IMAGES = ['chef', 'wave', 'market', 'forest', 'collie', 'river', 'lobby', 'turtle'] as const
const CYCLE = 80
const PACE = CYCLE / 16
const SIDE_STEP = PACE * 2
const ECHO_OFFSET = 35

// Where in the gutter a card travels, and how it looks doing it. Four lanes a
// side. Two ways of placing a lane keep them all off the copy: an `edge` lane
// is measured in from the viewport's side; a `column` lane is measured *out*
// from the headline column's edge — `50% ± 22.5rem`, the column being 45rem
// wide and centred — so whatever the viewport, its inner edge is a fixed gap
// from the text.
const COLUMN_HALF = '22.5rem'
const GAP = '1.5rem'

type Side = 'left' | 'right'
type Lane = { place: 'edge' | 'column', at: string, width: string, rotate: number, z: number }
const LANES: Record<Side, Lane[]> = {
  left: [
    { place: 'edge', at: '3%', width: 'clamp(8rem, 11vw, 13rem)', rotate: -8, z: 1 },
    { place: 'column', at: '1rem', width: 'clamp(9rem, 13vw, 16rem)', rotate: 6, z: 2 },
    { place: 'edge', at: '9%', width: 'clamp(8rem, 12vw, 15rem)', rotate: -12, z: 1 },
    { place: 'column', at: '3rem', width: 'clamp(7rem, 9vw, 11rem)', rotate: 10, z: 2 }
  ],
  right: [
    { place: 'edge', at: '4%', width: 'clamp(9rem, 13vw, 16rem)', rotate: 8, z: 1 },
    { place: 'column', at: '1.5rem', width: 'clamp(8rem, 11vw, 14rem)', rotate: -10, z: 2 },
    { place: 'edge', at: '8%', width: 'clamp(8rem, 11vw, 13rem)', rotate: 12, z: 1 },
    { place: 'column', at: '2rem', width: 'clamp(7rem, 10vw, 12rem)', rotate: -6, z: 2 }
  ]
}

/** The CSS that puts a lane where its `place` says. A column lane is
    positioned by its inner edge. An edge lane is measured in from the side but
    capped by the same column rule: `min()` takes the smaller inset, so on a
    narrow screen where 3% in would reach the text, the card slides outward
    instead, rather than over a button. */
function anchorFor(side: Side, lane: Lane): Record<string, string> {
  const clearOfColumn = `calc(50% - ${COLUMN_HALF} - ${GAP} - var(--w))`
  if (lane.place === 'edge') return { [side]: `min(${lane.at}, ${clearOfColumn})` }
  return { [side === 'left' ? 'right' : 'left']: `calc(50% + ${COLUMN_HALF} + ${lane.at})` }
}

// A little deterministic unevenness in the launches, indexed by launch order.
// Sixteen cards exactly PACE seconds apart read as a conveyor; nudged by a
// fraction of a second they read as things arriving. Small enough — under a
// second either way — that neither guarantee above comes close to failing,
// and fixed rather than random so the circuit is the same every visit.
const JITTER = [0.4, -0.6, 0.2, -0.3, 0.6, -0.2, 0.5, -0.6, -0.3, 0.5, -0.5, 0.3, -0.6, 0.4, 0.1, -0.4]

const slots = IMAGES.flatMap((src, i) => {
  const leftAt = i * SIDE_STEP
  const rightAt = (leftAt + ECHO_OFFSET) % CYCLE
  // A side's lane rotates with its launch order: the i-th left launch takes
  // lane i, the j-th right launch lane j. The right order is the left order
  // shifted by the offset, which is what lands each photograph in a different
  // lane on its second appearance.
  const rightOrder = (rightAt - PACE) / SIDE_STEP
  const make = (side: Side, launch: number, order: number, echo: boolean) => {
    const lane = LANES[side][order % 4]!
    return {
      key: `${src}-${side}`,
      src,
      side,
      echo,
      lane,
      anchor: anchorFor(side, lane),
      launch: launch + JITTER[launch / PACE]!,
      // Parking height for reduced motion, spread across the band.
      rest: `${8 + (i * 9) % 72}%`
    }
  }
  // Under reduced motion only one appearance of each photograph is parked, and
  // which one alternates so the still composition has four cards a side.
  const parkLeft = i % 2 === 0
  return [
    make('left', leftAt, i, !parkLeft),
    make('right', rightAt, rightOrder, parkLeft)
  ]
})
</script>

<style scoped>
/* The band. Positioned against the headline column but stretched to the full
   viewport width, since the cards live in the gutters either side of it. It
   starts above the copy — up into the header, which is transparent over the
   hero for exactly this reason — and reaches well below the buttons, a third
   of the way down the product shot, so a card is already rising beside the
   shot before it passes the headline.

   `container-type: size` is what makes the travel distance work without any
   script: the keyframe below moves a card by the band's own height in `cqh`.
   Not clipped: a card is fully transparent at both ends of its journey, and
   clipping was what left cards cut flat across the bottom as they faded in.
   Behind the copy by z-index — the container above establishes the stacking
   context, so a negative index goes under the text and the product shot but
   stays above the page. */
.cards {
  position: absolute;
  top: -8rem;
  bottom: -18rem;
  left: calc(50% - 50vw);
  width: 100vw;
  z-index: -1;
  container-type: size;
  pointer-events: none;
}

/* Each card carries only the climb and the fade; its tilt and scale live on
   the image inside it. That split is load-bearing: CSS applies an individual
   `rotate` *after* `transform`, so a tilted element that also translates moves
   along its own tilted axis — which had every card drifting sideways.

   One animation per card, one cycle long. The rise fills the first PASS
   seconds of it; for the rest the card waits at the top, invisible, until its
   slot comes round again. */
.cards__card {
  position: absolute;
  top: 100%;
  width: var(--w);
  animation: cards-rise 80s linear infinite;
  animation-delay: var(--delay);
  will-change: transform, opacity;
}

/* Fractions of the 80s cycle: fade in over the first 6%, out over the last 6%
   of a 35% pass, then hold at the top, transparent, until the cycle wraps. */
@keyframes cards-rise {
  0%   { transform: translateY(0);                     opacity: 0; }
  6%   { opacity: 1; }
  29%  { opacity: 1; }
  35%  { transform: translateY(calc(-100cqh - 100%)); opacity: 0; }
  100% { transform: translateY(calc(-100cqh - 100%)); opacity: 0; }
}

.cards__photo {
  display: block;
  width: 100%;
  /* Taller than square: the photographs are square, and a portrait crop is what
     makes the group read as prints rather than as thumbnails. */
  aspect-ratio: 4 / 5;
  object-fit: cover;
  border-radius: 1.25rem;
  box-shadow:
    0 1px 2px rgb(0 0 0 / 0.08),
    0 12px 32px -8px rgb(0 0 0 / 0.22);
  rotate: var(--rot);
  animation: cards-breathe 80s linear infinite;
  animation-delay: var(--delay);
  will-change: scale;
}

/* In from small, out to small, on the same clock and the same fractions as
   the climb, so the two cannot drift apart. */
@keyframes cards-breathe {
  0%   { scale: 0.55; }
  6%   { scale: 1; }
  29%  { scale: 1; }
  35%  { scale: 0.55; }
  100% { scale: 0.55; }
}

/* Below `lg` there is no gutter — the copy takes the whole width — so the
   stream keeps running from the wings: every card small and pinned to a screen
   edge, running behind the ends of the lines.

   1.25rem of a 6rem card past the edge, and no more: that keeps at least three
   quarters of every photograph on screen even at the steepest tilt, where a
   corner reaches furthest out (79% at ±12°, measured over the rotated card). The
   earlier 3.5rem left under half of each one showing, which read as cropped
   rather than as passing by. Any less inset puts more of the card behind the
   text.

   `!important` because the desktop placement is inline, and a card's inline
   `left` would otherwise beat the `right` set here. Both sides are set
   explicitly for the same reason: a right-hand card that was column-placed
   arrives with an inline `left`. */
@media (width < 64rem) {
  .cards__card {
    width: 6rem !important;
  }
  .cards__card--left {
    left: -1.25rem !important;
    right: auto !important;
  }
  .cards__card--right {
    left: auto !important;
    right: -1.25rem !important;
  }
}

/* On a portrait phone the copy runs nearly edge to edge, and a 6rem card reaching
   five rem in sat across the ends of the lines far enough to hurt reading. Below
   `sm` the cards are a size smaller and set a little further out: 5rem with 1rem
   past the edge, which still keeps at least three quarters of each photograph on
   screen at the steepest tilt (80% at ±12°). Landscape phones and tablets have
   the room, and keep the larger cards above. */
@media (width < 40rem) {
  .cards__card {
    width: 5rem !important;
  }
  .cards__card--left {
    left: -1rem !important;
  }
  .cards__card--right {
    right: -1rem !important;
  }
}

/* Someone who has asked for less motion gets a still composition: the first
   appearance of each photograph parked at its own height, full size and fully
   opaque. The second appearances are dropped entirely — parked, they would put
   every picture on screen twice at once, which is the one thing the circuit
   exists to prevent. */
@media (prefers-reduced-motion: reduce) {
  .cards__card {
    top: var(--rest);
    opacity: 1;
    animation: none;
  }
  .cards__card--echo {
    display: none;
  }
  .cards__photo {
    animation: none;
  }
}
</style>
