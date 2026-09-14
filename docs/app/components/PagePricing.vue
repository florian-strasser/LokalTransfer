<template>
  <section
    id="pricing"
    class="section"
  >
    <div class="container">
      <SplitText
        as="h2"
        text="Pricing"
        class="mb-8 text-3xl font-semibold tracking-tight text-dark text-balance sm:text-4xl lg:text-5xl"
      />

      <!-- Two cards, and the free one is the plain card on the left: the
           software is the point of the page, and the service is an offer beside
           it rather than a tier above it. The second card says so in as many
           words, because two prices side by side otherwise read as two editions
           of the product — there is still only one build, and it is free.

           Neither card carries a feature list. With nothing to compare against,
           most such lines are chores dressed as features: "you apply the
           updates" is what self-hosting means, not something on offer.

           No `items-start`: the cards stretch to the taller of the two, so the
           pair reads as one row rather than two blocks that drift apart as the
           copy in either changes. Each is a column with its button held to the
           bottom edge by `mt-auto`, so the two buttons line up whatever is
           written above them. -->
      <div class="mx-auto grid gap-6 md:grid-cols-2">
        <FadeInBottom class="flex">
          <div class="flex w-full flex-col rounded-3xl bg-slate p-8 text-center sm:p-10">
            <p class="text-sm font-medium tracking-wide text-gray uppercase">
              Self-hosted
            </p>
            <p class="mt-3 text-6xl font-semibold tracking-tight text-dark sm:text-7xl">
              0 €
            </p>
            <p class="mt-2 text-gray">
              Forever, for any number of people
            </p>

            <p class="mt-6 text-dark">
              LokalTransfer is open source under the MIT licence. There is no
              paid tier, no size tier and no edition held back — a freelancer and
              an agency install the same build. What it costs you is the server
              it runs on.
            </p>

            <div class="mt-auto flex justify-center pt-8">
              <NuxtLink
                to="/docs"
                class="rounded-full bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-hover"
              >
                Getting started
              </NuxtLink>
            </div>
          </div>
        </FadeInBottom>

        <FadeInBottom class="flex">
          <div class="flex w-full flex-col rounded-3xl bg-primary/5 p-8 text-center sm:p-10">
            <p class="text-sm font-medium tracking-wide text-gray uppercase">
              Setup service
            </p>
            <p class="mt-3 text-6xl font-semibold tracking-tight text-dark sm:text-7xl">
              299 €
            </p>
            <p class="mt-2 text-gray">
              One-time
            </p>

            <p class="mt-6 text-dark">
              Don't want to touch a terminal? I'll install LokalTransfer on your
              server and hand you the keys. The software is still free — this
              pays for my time, not a licence. The server is rented from your
              hosting provider and billed by them.
            </p>

            <div class="mt-auto flex justify-center pt-8">
              <a
                href="mailto:kontakt@florian-strasser.de?subject=LokalTransfer%20Setup%20Service%20request"
                class="rounded-full bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-hover"
              >
                Get in touch
              </a>
            </div>
          </div>
        </FadeInBottom>
      </div>
    </div>
  </section>
</template>
