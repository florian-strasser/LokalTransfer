<template>
  <!-- The flag, filling the tile's width at the height every other illustration
       has. The circle of stars keeps its real proportion to that height — two
       thirds of it across, each star a ninth — which is why the SVG is sized from
       the height and the circle drawn from the same number. -->
  <div
    class="eu"
    aria-hidden="true"
  >
    <svg
      class="eu__stars"
      viewBox="0 0 100 100"
    >
      <g class="eu__ring">
        <!-- Placed by rotating out to the circle and then straightening up
             again, which is how the twelve stars stand upright on the flag
             rather than fanning outwards. -->
        <g
          v-for="i in 12"
          :key="i"
          :transform="`translate(50 50) rotate(${(i - 1) * 30}) translate(0 -33.3) rotate(${-(i - 1) * 30})`"
        >
          <path
            class="eu__star"
            :style="{ animationDelay: `${(-(i - 1) * 6) / 12}s` }"
            :d="STAR"
          />
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
// One five-pointed star, centred on the origin so the placement transform above
// is the only thing deciding where it goes.
const STAR = 'M0,-5.55 L1.28,-1.76 L5.28,-1.72 L2.07,0.67 L3.26,4.49 L0,2.18 L-3.26,4.49 L-2.07,0.67 L-5.28,-1.72 L-1.28,-1.76 Z'
</script>

<style scoped>
.eu {
  display: grid;
  place-items: center;
  /* Full width at a fixed height, rather than the flag's 3:2 taken from the
     width: that grew taller than every other illustration as the tile widened. */
  width: 100%;
  height: 10rem;
  border-radius: 0.75em;
  background: #003399;
  overflow: hidden;
}
.eu__stars {
  /* Square, sized from the height — so the circle keeps its proportion of the
     flag whatever width the tile ends up at. */
  height: 60%;
  width: auto;
}
/* A full turn takes a minute: slow enough to read as the circle of stars rather
   than as a spinning thing, but never quite still. */
.eu__ring {
  transform-origin: 50px 50px;
  animation: eu-spin 60s linear infinite;
}
.eu__star {
  fill: #ffcc00;
  transform-box: fill-box;
  transform-origin: center;
  /* Each star a twelfth of the cycle behind the one before it, so the pulse
     travels round the circle instead of all twelve blinking together. */
  animation: eu-pulse 6s ease-in-out infinite;
}

@keyframes eu-spin {
  to { transform: rotate(360deg); }
}
@keyframes eu-pulse {
  0%, 100% { transform: scale(1); opacity: 0.78; }
  18%      { transform: scale(1.2); opacity: 1; }
  40%      { transform: scale(1); opacity: 0.78; }
}

@media (prefers-reduced-motion: reduce) {
  .eu__ring,
  .eu__star {
    animation: none;
  }
  .eu__star {
    opacity: 1;
  }
}
</style>
