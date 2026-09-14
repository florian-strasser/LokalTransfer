<template>
  <!-- The logo's own construction, continued: overlapping circles stepping up
       in size along a line that leans a few degrees, running the full width of
       the section. Each one emerges — from nothing at half size to full size at
       full opacity — and they are staggered, so a wave travels left to right,
       which is the direction a transfer goes.

       Nothing here is ever cut by the section's top or bottom. Every circle is
       sized as a share of the section's *height* and placed so that its top
       and bottom stay inside it, whatever shape the section is. The row is
       long enough to reach the right edge of an ultra-wide monitor, so on any
       narrower screen it simply runs off the sides — the one edge a shape may
       cross, because that reads as the row continuing, where a circle sliced
       flat across its middle reads as a mistake.

       `aria-hidden` and `pointer-events-none`: decoration, so it should reach
       neither a screen reader nor the cursor. -->
  <div
    class="cta-backdrop pointer-events-none absolute inset-0"
    aria-hidden="true"
  >
    <span
      v-for="circle in circles"
      :key="circle.i"
      class="cta-circle"
      :style="{
        left: `${circle.x}cqh`,
        top: `${circle.y}cqh`,
        width: `${circle.d}cqh`,
        height: `${circle.d}cqh`,
        animationDelay: circle.delay
      }"
    />
  </div>
</template>

<script setup lang="ts">
// The mark is three circles with centres roughly half the sum of their radii
// apart — overlapping, not in a row. That ratio is kept here, so the line reads
// as the logo continued rather than as a generic pattern.
//
// Everything is in `cqh`, hundredths of the section's height, including the
// horizontal positions: a circle's size and its spacing then keep their
// relationship at every viewport, and only how much of the row fits changes.
// The first GROWTH circles step up in size the way the mark does; after that
// the size holds, so the row can be as long as it needs to be without the last
// circle outgrowing the section.
const COUNT = 24
const GROWTH = 13
const OVERLAP = 0.53

// Diameters as a share of the height, and the row's lean: the centre line drops
// LEAN hundredths across the growth. The largest circle sits lowest, and its
// bottom edge lands at 64 + 34 = 98 — inside the section, by construction.
const D_FROM = 22
const D_TO = 68
const LEAN = 28

// How far apart neighbours start their ten-second emergence (the cycle is in
// the style block). The stagger is what makes it a wave instead of two dozen
// circles breathing in unison.
const STAGGER_SECONDS = 0.42

let x = -6
let previousRadius = 0
const circles = Array.from({ length: COUNT }, (_, i) => {
  const t = Math.min(i / (GROWTH - 1), 1)
  const d = D_FROM + t * (D_TO - D_FROM)
  const r = d / 2
  if (i > 0) x += OVERLAP * (previousRadius + r)
  previousRadius = r

  return {
    i,
    x,
    y: 50 + (t - 0.5) * LEAN,
    d,
    // Negative, so the wave is already mid-flight on the first frame rather
    // than every circle waiting its turn from a blank section.
    delay: `${-i * STAGGER_SECONDS}s`
  }
})
</script>

<style scoped>
/* `container-type: size` is what gives the circles their unit. The backdrop is
   positioned against the section and takes its size from it, so a `cqh` inside
   is a hundredth of the section's height. Not clipped here: vertically nothing
   can leave, and horizontally the section clips for it. */
.cta-backdrop {
  container-type: size;
}

.cta-circle {
  position: absolute;
  border-radius: 50%;
  /* The accent, pale: on white the circles need colour, not transparency, or
     every overlap shows through. */
  background: color-mix(in oklab, var(--color-primary) 14%, white);
  /* `left`/`top` name the centre; this puts the box around it. */
  translate: -50% -50%;
  animation: cta-emerge 10s ease-out infinite;
  will-change: opacity, scale;
}

/* In at half size and invisible, out at full size and full opacity. The tail
   fades back to nothing *at* full size, so the jump back to half size happens
   while the circle cannot be seen — a loop with no visible reset. */
@keyframes cta-emerge {
  0%   { opacity: 0; scale: 0.5; }
  55%  { opacity: 1; scale: 1; }
  100% { opacity: 0; scale: 1; }
}

/* Someone who has asked their system for less motion gets the row at rest:
   the same circles, simply not moving. */
@media (prefers-reduced-motion: reduce) {
  .cta-circle {
    animation: none;
    opacity: 1;
  }
}
</style>
