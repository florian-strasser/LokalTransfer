<template>
  <!-- Clipped sideways only. The cards may run off the section's sides — clipped
       here rather than at the page, or a card bleeding right would give the
       whole page a horizontal scrollbar — but they must be free to rise *above*
       the section, up into the header, where they fade out. `clip` is the one
       overflow value that does this: `overflow-x: hidden` would force the
       vertical axis to `auto` and cut them off at the top. -->
  <section class="relative overflow-clip pb-28">
    <div class="relative min-h-screen mt-0 flex flex-col justify-center">
      <div class="container relative z-10 pt-20 sm:pt-28 pb-14 sm:pb-20">
        <!-- `relative`: the card band positions itself against this column — it
            is what gives the band its height, top of the copy to the bottom of
            the buttons, and its horizontal centre. -->
        <div class="relative w-180 max-w-full text-center mx-auto">
          <HeroCards :fade="cardsOpacity" />

          <SplitText
            as="p"
            text="Self-hosted file transfer"
            :stagger="0.02"
            class="text-sm font-medium text-primary"
          />
          <SplitText
            as="h1"
            text="Send files to clients and let them send files back."
            :delay="0.15"
            :stagger="0.02"
            class="mt-3 text-4xl font-semibold leading-[1.05] text-balance tracking-tight text-dark sm:text-5xl lg:text-6xl"
          />
          <SplitText
            as="p"
            by="word"
            text="LokalTransfer is an open-source, self-hosted alternative to WeTransfer. Links expire, the files are really deleted, and nothing touches a third-party service — because it runs on your own server."
            :delay="0.6"
            :stagger="0.015"
            class="mt-6 max-w-xl mx-auto text-lg leading-relaxed"
          />

          <FadeInBottom
            :delay="1"
            class="mt-8"
          >
            <div class="flex flex-wrap items-center justify-center gap-3">
              <NuxtLink
                to="/docs"
                class="rounded-full bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-hover"
              >
                Get started
              </NuxtLink>
              <a
                href="https://github.com/florian-strasser/LokalTransfer"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded-full border border-gray/25 px-6 py-3 font-medium text-dark transition-colors hover:border-gray/50"
              >
                View on GitHub
              </a>
            </div>
          </FadeInBottom>
        </div>
      </div>
    </div>
    <div class="container relative z-10">
      <Motion
        ref="shot"
        as="div"
        :style="{ scale, transformOrigin: 'top center' }"
      >
        <div class="overflow-hidden rounded-2xl -translate-y-12">
          <img
            src="/images/download-page.webp"
            alt="A LokalTransfer download page: the recipient's file list beside the sender's own background image"
            width="1440"
            height="900"
            class="block h-auto w-full"
          >
        </div>
      </Motion>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useReducedMotion, useScroll, useTransform } from 'motion-v'

const shot = useTemplateRef<{ $el: HTMLElement }>('shot')
const reduced = useReducedMotion()

// Progress of the screenshot itself toward the reader: 0 while its top edge is
// still low in the viewport, 1 once it has reached the upper fifth. Measured on
// the element, not on the page, so it holds wherever the hero ends up above it.
const { scrollYProgress } = useScroll({
  target: computed(() => shot.value?.$el ?? null),
  offset: ['start 85%', 'start 20%']
})

const scale = useTransform(scrollYProgress, [0, 1], [reduced.value ? 1 : 0.5, 1])

// The photographs behind the headline make way for the product. They fade on the
// very progress that grows the screenshot, and are gone at the moment it reaches
// full size — so the finished shot never has cards peeking past its corners.
// Opacity only, which is why it applies with reduced motion as well.
const cardsOpacity = useTransform(scrollYProgress, [0, 1], [1, 0])
</script>
