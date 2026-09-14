<template>
  <!-- Full-bleed: the backdrop is positioned against the section, not a panel
       inside it, so the circles run the whole width of the page — the same
       composition as the closing section on LokalBoards. The copy sits in the
       page's own colours on the page's own white; there is no box. -->
  <section class="relative isolate overflow-x-clip py-24 text-center sm:py-32">
    <CtaBackdrop />

    <div class="container relative z-10">
      <div class="mx-auto max-w-2xl">
        <SplitText
          as="h2"
          text="Your files, your server, your rules."
          class="text-3xl font-semibold tracking-tight text-dark text-balance sm:text-4xl lg:text-5xl"
        />
        <SplitText
          as="p"
          by="word"
          text="MIT licensed and free forever. No accounts to buy, no size tiers, and no third party holding your clients' files."
          :delay="0.35"
          class="mx-auto mt-5 max-w-xl text-lg leading-relaxed"
        />
        <FadeInBottom
          :delay="0.6"
          class="mt-8"
        >
          <div class="flex flex-wrap items-center justify-center gap-3">
            <NuxtLink
              to="/docs"
              class="rounded-full bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Install it
            </NuxtLink>
            <NuxtLink
              to="/api"
              class="rounded-full border border-gray/25 px-6 py-3 font-medium text-dark transition-colors hover:border-gray/50"
            >
              Read the API
            </NuxtLink>
          </div>
        </FadeInBottom>
      </div>
    </div>
  </section>
</template>
