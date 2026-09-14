<template>
  <!-- One hex, cycling. Everything tinted here follows the same custom property
       the app derives its whole 50–950 ramp from, so the swatch, the button, the
       chip and the link change together — which is the claim the tile makes. -->
  <div
    class="ui col"
    aria-hidden="true"
  >
    <div
      class="ui-panel"
      :style="{ '--accent': current.hex }"
    >
      <div class="ui-head">
        <span>Accent colour</span>
        <code class="col__hex">{{ current.hex }}</code>
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
// a glance. The first is the app's own default, and the resting frame.
const colours = [
  { hex: '#CC0030' },
  { hex: '#0066CC' },
  { hex: '#0F8A5F' },
  { hex: '#7A3FF2' }
]

// Stepped by a timer rather than a keyframe on `--accent`: a custom property
// cannot be animated on the compositor, so the keyframe had the browser repainting
// the tile on its main thread for the whole cycle. The change was instant anyway,
// so nothing is lost by switching it from script every three and a half seconds.
const index = ref(0)
const current = computed(() => colours[index.value]!)

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  timer = setInterval(() => {
    index.value = (index.value + 1) % colours.length
  }, 3500)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.col__hex {
  font-size: 0.95em;
  color: var(--accent);
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
</style>
