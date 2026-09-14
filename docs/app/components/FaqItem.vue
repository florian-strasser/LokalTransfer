<template>
  <FadeInBottom class="pt-4 lg:pt-5">
    <div class="rounded-2xl bg-slate">
      <button
        :id="`faq-control-${index + 1}`"
        class="faq__question flex w-full cursor-pointer items-center justify-between rounded-2xl py-6 text-left transition-colors duration-300"
        :class="open ? 'text-primary' : 'text-gray hover:text-primary'"
        :aria-controls="`faq-content-${index + 1}`"
        :aria-expanded="open"
        @click="toggle"
      >
        <h3 class="text-base font-medium sm:text-lg">
          {{ question }}
        </h3>
        <!-- Two bars crossed into a plus; the second turns away to leave a
             minus, which is the whole open/closed signal. -->
        <span
          class="faq__bars"
          aria-hidden="true"
        >
          <span class="faq__bar" />
          <span
            class="faq__bar transition-transform duration-300"
            :class="{ 'rotate-90': !open }"
          />
        </span>
      </button>

      <div
        :id="`faq-content-${index + 1}`"
        ref="panel"
        class="faq__answer h-0 overflow-clip text-gray"
        :aria-hidden="!open"
      >
        <!-- The answers are markup authored in PageFaq.vue, in this repository,
             by the people who write the documentation — never anything a
             visitor typed. That is the one case `v-html` is for. -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="faq__answer-inner space-y-3 lg:space-y-4"
          v-html="answer"
        />
        <!-- eslint-enable vue/no-v-html -->
      </div>
    </div>
  </FadeInBottom>
</template>

<script setup lang="ts">
// One accordion row. The answer's height is animated to `auto` and back by
// Motion, which measures the content for us; the panel itself stays in the
// document at height 0 so the page never jumps around a row that is closed.
import { animate } from 'motion-v'

defineProps<{ question: string, answer: string, index: number }>()

const panel = useTemplateRef<HTMLElement>('panel')
const open = ref(false)

function toggle() {
  if (!panel.value) return
  open.value = !open.value
  animate(panel.value, { height: open.value ? 'auto' : 0 }, { ease: 'linear' })
}
</script>

<style scoped>
.faq__question {
  padding: 1rem 2rem;
}
.faq__bars {
  position: relative;
  flex: none;
  width: 1em;
  height: 1em;
  margin-left: 1em;
}
.faq__bar {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1em;
  height: 0.1em;
  background: currentColor;
  translate: -50% -50%;
}
.faq__answer-inner {
  padding: 0 2rem 2rem;
}
/* The answers arrive as markup, so their tags are below this component's
   scope; `:deep` is what lets the styles reach them. */
.faq__answer-inner :deep(p) {
  line-height: 1.65;
}
.faq__answer-inner :deep(code) {
  padding: 0.1em 0.4em;
  border-radius: 0.3em;
  background: var(--color-code-bg);
  color: var(--color-code-text);
  font-size: 0.9em;
}
.faq__answer-inner :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
</style>
