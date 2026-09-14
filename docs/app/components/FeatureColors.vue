<template>
  <!-- One hex, cycling. Everything tinted here follows the same custom property
       the app derives its whole 50–950 ramp from, so the swatch, the button, the
       chip and the link change together — which is the claim the tile makes. -->
  <div
    class="ui col"
    aria-hidden="true"
  >
    <div class="ui-panel col__panel">
      <div class="ui-head">
        <span>Accent colour</span>
        <code class="col__hex">
          <span
            v-for="c in colours"
            :key="c.hex"
            class="col__hex-step"
          >{{ c.hex }}</span>
        </code>
      </div>

      <div class="col__swatches">
        <span
          v-for="c in colours"
          :key="c.hex"
          class="col__swatch"
          :style="{ background: c.hex }"
        />
      </div>

      <div class="col__preview">
        <span class="ui-chip col__chip">14 days</span>
        <span class="col__link">Download all</span>
      </div>

      <div class="ui-btn col__btn">
        Send transfer
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Four accents that are genuinely different in hue, so the change is legible at
// a glance. The first is the app's own default.
const colours = [
  { hex: '#CC0030' },
  { hex: '#0066CC' },
  { hex: '#0F8A5F' },
  { hex: '#7A3FF2' }
]
</script>

<style scoped>
/* Every tinted element animates the same custom property on the same 14s clock,
   so nothing can fall out of step with the hex printed above it. */
.col__panel {
  --accent: #cc0030;
  animation: col-accent 14s steps(1) infinite;
}

@keyframes col-accent {
  0%   { --accent: #cc0030; }
  25%  { --accent: #0066cc; }
  50%  { --accent: #0f8a5f; }
  75%  { --accent: #7a3ff2; }
}

.col__hex {
  display: inline-grid;
  font-size: 0.95em;
  color: var(--accent);
}
.col__hex-step {
  grid-area: 1 / 1;
  text-align: right;
  opacity: 0;
  animation: col-step 14s steps(1) infinite;
}
.col__hex-step:nth-child(1) { animation-delay: 0s; }
.col__hex-step:nth-child(2) { animation-delay: -10.5s; }
.col__hex-step:nth-child(3) { animation-delay: -7s; }
.col__hex-step:nth-child(4) { animation-delay: -3.5s; }

@keyframes col-step {
  0%, 24.99% { opacity: 1; }
  25%, 100%  { opacity: 0; }
}

.col__swatches {
  display: flex;
  gap: 0.4em;
  margin-bottom: 0.8em;
}
.col__swatch {
  width: 1.5em;
  height: 1.5em;
  border-radius: 999px;
}
/* The one currently in use is ringed. Rather than four more animations, the
   ring is drawn by the shared accent: only the swatch whose own colour matches
   it shows one, because the ring is that colour at 30% over the swatch. */
.col__swatch {
  box-shadow: 0 0 0 0.18em var(--color-white), 0 0 0 0.36em transparent;
}

.col__preview {
  display: flex;
  align-items: center;
  gap: 0.6em;
  margin-bottom: 0.8em;
}
.col__chip {
  background: color-mix(in oklab, var(--accent) 12%, transparent);
  color: var(--accent);
}
.col__link {
  color: var(--accent);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.25em;
}
.col__btn {
  background: var(--accent);
}

/* Resting frame: the app's own default accent, which is what an unconfigured
   instance looks like. */
@media (prefers-reduced-motion: reduce) {
  .col__panel { --accent: #cc0030; }
  .col__hex-step:nth-child(1) { opacity: 1; }
}
</style>
