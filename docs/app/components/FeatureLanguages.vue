<template>
  <div
    class="ui lang"
    aria-hidden="true"
  >
    <!-- One button out of the app, relabelling itself. The strings are the
         real `compose.send` values from the ten locale files, not translations
         invented for a picture — including the one beyond the Latin alphabet. -->
    <span class="lang__code">{{ current.code }}</span>

    <!-- Width is animated rather than left to the content, so the button
         eases out and settles instead of snapping to each new length. It has
         to be a measured pixel value: `width: auto` is not something CSS can
         transition between. -->
    <span
      class="ui-btn lang__button"
      :style="buttonStyle"
    >
      <UiIcon name="upload" />
      <span
        class="lang__label"
        :class="{ 'lang__label--out': swapping }"
      >{{ current.label }}</span>
    </span>

    <!-- An off-screen copy of the whole button for every language, purely to
         measure. Copying the button rather than just the text means the
         padding, the gap and the icon are all in the number already. -->
    <span
      ref="ruler"
      class="lang__ruler"
    >
      <span
        v-for="entry in languages"
        :key="entry.code"
        class="ui-btn lang__measure"
      >
        <UiIcon name="upload" />
        <span class="lang__label">{{ entry.label }}</span>
      </span>
    </span>

    <p class="lang__count">
      10 languages
    </p>
  </div>
</template>

<script setup lang="ts">
// The send button in each of the ten languages the app ships, in the order
// the app lists them.
const languages = [
  { code: 'EN', label: 'Send transfer' },
  { code: 'DE', label: 'Übertragung senden' },
  { code: 'FR', label: 'Envoyer le transfert' },
  { code: 'ES', label: 'Enviar transferencia' },
  { code: 'IT', label: 'Invia trasferimento' },
  { code: 'NL', label: 'Overdracht versturen' },
  { code: 'PL', label: 'Wyślij transfer' },
  { code: 'UK', label: 'Надіслати передачу' },
  { code: 'PT', label: 'Enviar transferência' },
  { code: 'CS', label: 'Odeslat přenos' }
]

const index = ref(0)
const swapping = ref(false)
const widths = ref<number[]>([])
const ruler = useTemplateRef<HTMLElement>('ruler')

const current = computed(() => languages[index.value]!)

// Until the labels have been measured the button sizes itself, which is also
// what the server renders — so the markup matches on hydration and the first
// paint is never a zero-width button.
const buttonStyle = computed(() =>
  (widths.value.length ? { width: `${widths.value[index.value]}px` } : {}))

let timer: ReturnType<typeof setInterval> | undefined
let swapTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  const measure = () => {
    const copies = ruler.value?.querySelectorAll('.lang__measure')
    if (!copies?.length) return
    widths.value = [...copies].map(el => Math.ceil((el as HTMLElement).getBoundingClientRect().width))
  }
  measure()
  // Re-measure once the webfont lands, or every width is a fallback-font width.
  document.fonts?.ready.then(measure)
  window.addEventListener('resize', measure)
  onUnmounted(() => window.removeEventListener('resize', measure))

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  timer = setInterval(() => {
    // Fade the old label out, change it while nothing is readable, fade the
    // new one in — the width eases across the whole exchange.
    swapping.value = true
    swapTimer = setTimeout(() => {
      index.value = (index.value + 1) % languages.length
      swapping.value = false
    }, 180)
  }, 2600)
})

onUnmounted(() => {
  clearInterval(timer)
  clearTimeout(swapTimer)
})
</script>

<style scoped>
.lang {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9em;
}
.lang__button {
  /* Centred by the column, and it stays centred because only its width
     changes — nothing about its position is being animated. */
  align-self: center;
  justify-content: center;
  white-space: nowrap;
  transition: width 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}
.lang__label {
  white-space: nowrap;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.lang__label--out {
  opacity: 0;
  transform: translateY(-0.35em);
}
.lang__code {
  padding: 0.15em 0.5em;
  border-radius: 0.35em;
  background: color-mix(in oklab, var(--color-dark) 8%, transparent);
  color: var(--color-gray);
  font-weight: 600;
  letter-spacing: 0.04em;
}
.lang__count {
  color: var(--color-gray);
  font-size: 0.85em;
}
.lang__ruler {
  position: absolute;
  left: -9999px;
  top: 0;
  display: flex;
  visibility: hidden;
}
.lang__measure {
  transition: none;
}
</style>
