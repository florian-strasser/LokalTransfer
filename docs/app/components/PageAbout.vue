<template>
  <section
    id="about"
    class="section"
  >
    <div class="container">
      <!-- Text on the left, the person who wrote it on the right. Seven columns
           to five: the argument leads and the portrait answers it, rather than
           the two splitting the row evenly like a card and its caption. Centred
           vertically, so a short paragraph beside a tall photo reads as one
           spread instead of text stranded at the top of a column. -->
      <div class="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div class="lg:col-span-7">
          <SplitText
            as="h2"
            text="Your work belongs on your own server."
            class="mt-3 text-3xl font-semibold tracking-tight text-dark text-balance sm:text-4xl lg:text-5xl"
          />

          <div
            ref="prose"
            class="mt-8 max-w-2xl space-y-5 text-lg leading-relaxed"
          >
            <SplitText
              v-for="paragraph in paragraphs"
              :key="paragraph.delay"
              as="p"
              by="word"
              :text="paragraph.text"
              :delay="paragraph.delay"
              :stagger="WORD_STAGGER"
              :play="proseInView"
            />
          </div>

          <!-- The sign-off. No avatar: the portrait beside it already is one. -->
          <FadeInBottom class="mt-10">
            <a
              href="https://www.florian-strasser.de"
              target="_blank"
              rel="noopener noreferrer"
              class="group inline-block"
            >
              <span class="block text-xl text-dark transition-colors group-hover:text-primary">Florian Strasser</span>
              <span class="block font-light text-gray">Creator of LokalTransfer</span>
            </a>
          </FadeInBottom>
        </div>

        <!-- The portrait. The frame is fixed and the photo inside it eases from
             a slight zoom to rest as the section passes, bound to the scroll
             position — enough to feel alive, not enough to be a special effect.
             `isolate` gives the rounded frame its own stacking context, which is
             what makes Safari clip a transformed child to the radius instead of
             letting its square corners show. -->
        <FadeInBottom class="lg:col-span-5">
          <figure
            ref="portrait"
            class="relative isolate mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-3xl bg-slate lg:max-w-none"
          >
            <Motion
              as="div"
              class="size-full"
              :style="{ scale }"
            >
              <img
                src="/images/florian-strasser-portrait.webp"
                srcset="/images/florian-strasser-portrait-640.webp 640w, /images/florian-strasser-portrait.webp 942w"
                sizes="(min-width: 64rem) 26rem, (min-width: 40rem) min(calc(100vw - 4rem), 28rem), calc(100vw - 3rem)"
                alt="Florian Strasser, the creator of LokalTransfer"
                width="942"
                height="1178"
                loading="lazy"
                class="block size-full object-cover object-top"
              >
            </Motion>
          </figure>
        </FadeInBottom>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useInView, useReducedMotion, useScroll, useTransform } from 'motion-v'

// The two paragraphs play as one sequence: the word-by-word reveal runs to the
// end of the first and carries on into the second, rather than both starting
// together. One observer for the pair starts it, and each paragraph's delay is
// where the one before it leaves off — so the copy can change without the
// timing having to be worked out again.
const WORD_STAGGER = 0.015
const FIRST_DELAY = 0.2

const prose = useTemplateRef<HTMLElement>('prose')
const proseInView = useInView(prose, { once: true, amount: 0.2 })

const paragraphs = [
  'Agencies and their clients make valuable things — ideas, drafts, photo shoots, finished campaigns. Far too often, all of it passes through the cloud of a big tech company on its way from one to the other, and once it is up there, where it is kept and for how long is no longer your decision.',
  'I built LokalTransfer to hand that control back. Keep your ideas and your creations on a server you choose, send them to the people they are meant for, and decide for yourself when they disappear — software that runs where you put it, and answers to you.'
].reduce<{ text: string, delay: number }[]>((list, text) => {
  const previous = list.at(-1)
  const delay = previous
    ? previous.delay + previous.text.split(' ').length * WORD_STAGGER
    : FIRST_DELAY
  return [...list, { text, delay }]
}, [])

const portrait = useTemplateRef<HTMLElement>('portrait')
const reduced = useReducedMotion()

// The frame's whole journey through the viewport, from its top edge entering at
// the bottom to its bottom edge leaving at the top. Measured on the frame, as the
// hero screenshot is, so it holds wherever the section ends up on the page.
const { scrollYProgress } = useScroll({
  target: computed(() => portrait.value ?? null),
  offset: ['start end', 'end start']
})

const scale = useTransform(scrollYProgress, [0, 1], [reduced.value ? 1 : 1.12, 1])
</script>
