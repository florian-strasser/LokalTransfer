<template>
  <!-- No `mt-auto`: app.vue gives <NuxtPage> `grow`, which already pushes the
       footer to the bottom on a short page. -->
  <footer
    role="contentinfo"
    class="w-full pt-8 pb-7 mt-8"
  >
    <div class="container text-gray">
      <div class="rounded-3xl bg-slate px-8 pt-10 pb-7 sm:px-12 sm:pt-14">
        <!-- The brand column is wider than the link columns because it holds a
             paragraph rather than a list. Below `lg` it takes a row of its own
             above the three lists, and on a phone everything stacks — link lists
             stack better than they wrap. -->
        <div
          class="grid grid-cols-1 gap-10 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-12"
        >
          <div class="col-span-1 xs:col-span-2 sm:col-span-3 lg:col-span-1">
            <NuxtLink
              to="/"
              aria-label="LokalTransfer"
              class="flex items-center gap-3 text-primary transition-colors hover:text-primary-hover"
            >
              <Logo class="w-10" />
              <span class="text-lg font-medium text-dark">LokalTransfer</span>
            </NuxtLink>

            <p class="mt-5 max-w-sm">
              File transfer that runs on your own server. Open source under the
              MIT licence, written in Germany, and no third party holding your
              clients' files.
            </p>

            <NuxtLink
              to="/docs"
              class="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-white transition-colors hover:bg-primary-hover"
            >
              Getting started
            </NuxtLink>
          </div>

          <div
            v-for="column in columns"
            :key="column.title"
          >
            <p class="mb-4 font-medium text-dark">
              {{ column.title }}
            </p>
            <ul class="space-y-2.5">
              <li
                v-for="link in column.links"
                :key="link.label"
              >
                <a
                  v-if="link.href"
                  :href="link.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="transition-colors hover:text-primary"
                >{{ link.label }}</a>
                <NuxtLink
                  v-else
                  :to="link.to"
                  class="transition-colors hover:text-primary"
                >{{ link.label }}</NuxtLink>
              </li>
            </ul>
          </div>
        </div>

        <div
          class="mt-12 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-gray/15 pt-6"
        >
          <p>© {{ year }} LokalTransfer · MIT licensed</p>
          <p>
            Made with ♥ by
            <a
              href="https://www.florian-strasser.de"
              target="_blank"
              rel="noopener noreferrer"
              class="transition-colors hover:text-primary"
            >Florian Strasser</a>
          </p>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
// Everything the footer links to, in the same three groups as LokalBoards: the
// homepage's sections, the rest of the site, and the legal pages. A link is either
// internal (`to`) or external (`href`); nothing here is a route that does not
// exist. Docker Hub stands where LokalBoards has its changelog, which this site
// does not have.
const columns = [
  {
    title: 'Menu',
    links: [
      { label: 'About', to: '/#about' },
      { label: 'Features', to: '/#features' },
      { label: 'Pricing', to: '/#pricing' },
      { label: 'FAQ', to: '/#faq' }
    ]
  },
  {
    title: 'Navigation',
    links: [
      { label: 'Documentation', to: '/docs' },
      { label: 'API reference', to: '/api' },
      { label: 'Source code', href: 'https://github.com/florian-strasser/LokalTransfer' },
      { label: 'Docker Hub', href: 'https://hub.docker.com/r/florianstrasser/lokaltransfer' }
    ]
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', to: '/privacy-policy' },
      { label: 'Site notice', to: '/site-notice' }
    ]
  }
]

const year = new Date().getFullYear()
</script>
