<template>
  <!-- Adapted from LokalBoards: the logo's emblem on the left, the navigation
       centred, and the repository on the right. Absolute, in every state and on
       every page, so it never moves the page's top edge; the pages leave room
       for it themselves.

       Over the hero, photographs rise up through this bar and fade out behind
       it, which is why it has no surface of its own. -->
  <header
    class="absolute top-0 left-0 z-40 w-full py-6"
    role="banner"
  >
    <!-- The sheet the small-screen menu opens into. It covers the whole
         viewport, with top padding keeping the first entry clear of the close
         button. `w-screen` rather than `inset-0` so its scrollbar sits at the
         window's edge, and `data-lenis-prevent` so it scrolls while the page
         behind it does not. -->
    <Transition name="sheet">
      <div
        v-if="open"
        class="fixed inset-0 bg-white md:hidden"
      />
    </Transition>
    <Transition name="menu">
      <nav
        v-if="open"
        class="menu-sheet fixed top-0 bottom-0 left-0 z-1 w-screen overflow-x-hidden overflow-y-auto overscroll-contain pt-24 pb-12 md:hidden"
        aria-label="Menu"
        data-lenis-prevent
      >
        <ul class="container">
          <li
            v-for="(item, index) in links"
            :key="item.label"
            class="menu-row border-t border-gray/15"
            :style="{ transitionDelay: `${60 + index * 45}ms` }"
          >
            <!-- A row that can expand does only that: the whole row is the
                 control, because a chevron beside a link is a coin toss on a
                 touch screen. The section's index page is the first entry
                 inside it. -->
            <button
              v-if="item.section"
              type="button"
              class="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
              :aria-expanded="expanded === item.section"
              @click="toggle(item.section)"
            >
              <span class="block grow py-5 text-2xl text-dark">{{ item.label }}</span>
              <UiIcon
                name="chevron-down"
                class="shrink-0 text-[1.3rem] text-gray transition-transform duration-300"
                :class="{ 'rotate-180': expanded === item.section }"
              />
            </button>
            <NuxtLink
              v-else
              :to="item.to"
              class="block py-5 text-2xl text-dark"
              @click="open = false"
            >
              {{ item.label }}
            </NuxtLink>

            <!-- Collapsed with `grid-template-rows: 0fr`, which animates to
                 `1fr` without the list having to be measured first. -->
            <div
              v-if="item.section"
              class="submenu"
              :class="{ 'submenu--open': expanded === item.section }"
            >
              <div>
                <ul class="flex flex-col gap-y-3 border-l border-gray/15 pb-6 pl-4">
                  <li
                    v-for="page in pagesOf(item.section)"
                    :key="page.path"
                  >
                    <NuxtLink
                      :to="page.path"
                      class="block"
                      :class="isCurrent(page.path) ? 'text-primary' : 'text-gray'"
                      @click="open = false"
                    >
                      {{ page.title }}
                    </NuxtLink>
                  </li>
                </ul>
              </div>
            </div>
          </li>

          <li
            class="menu-row mt-8"
            :style="{ transitionDelay: `${60 + links.length * 45}ms` }"
          >
            <a
              :href="repository"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-center font-medium text-white hover:bg-primary-hover"
              @click="open = false"
            >
              <UiIcon name="github" />
              GitHub
            </a>
          </li>
        </ul>
      </nav>
    </Transition>

    <!-- Three tracks rather than `justify-between`: the navigation is centred on
         the page, not on whatever space the emblem and the button leave over, so
         it stays put if either changes width. While the sheet is open the row is
         transparent to the pointer — a wheel across the top of the screen then
         scrolls the sheet — and the close button takes its own back. -->
    <div
      class="container relative z-2 flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]"
      :class="{ 'pointer-events-none': open }"
    >
      <!-- `invisible` rather than `hidden` while the sheet is open: the row
           keeps its size, so the close button opposite does not move. -->
      <NuxtLink
        to="/"
        aria-label="LokalTransfer — home"
        class="pointer-events-auto block justify-self-start text-primary transition-colors hover:text-primary-hover"
        :class="{ invisible: open }"
        @click="open = false"
      >
        <Logo class="block h-8 w-auto sm:h-12" />
      </NuxtLink>

      <nav
        class="hidden md:block md:justify-self-center"
        aria-label="Main"
      >
        <ul class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <li
            v-for="item in links"
            :key="item.label"
          >
            <NuxtLink
              :to="item.to"
              class="transition-colors hover:text-primary"
              :class="item.section && isSection(item.to) ? 'text-primary' : 'text-gray'"
            >
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <a
        :href="repository"
        target="_blank"
        rel="noopener noreferrer"
        class="hidden items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-hover md:inline-flex md:justify-self-end"
      >
        <UiIcon name="github" />
        GitHub
      </a>

      <!-- Two bars that cross into a close mark, so the control never changes
           place or size. Pinned while the sheet is open, at the exact offset it
           rests at when closed (24px of header padding plus the bars centred in
           the emblem's 32px row), so it does not move as it is pressed. -->
      <button
        type="button"
        class="burger pointer-events-auto grid w-7 cursor-pointer gap-1.5 py-1.5 text-dark md:hidden"
        :class="{ 'burger--open fixed top-[29px] right-6 z-30 sm:right-8': open }"
        :aria-expanded="open"
        aria-label="Menu"
        @click="open = !open"
      >
        <span class="burger__bar" />
        <span class="burger__bar" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useLenis } from 'lenis/vue'

// The four homepage sections plus the documentation. Absolute paths rather than
// bare fragments, so they work from the docs and API pages too; Lenis runs with
// `anchors: true`, so the scroll to them is the smooth one the page uses.
// `section` names the content menu a row expands into on small screens, and
// must match the section title `useDocsNavigation` gives exactly.
const links = [
  { label: 'About', to: '/#about' },
  { label: 'Features', to: '/#features' },
  { label: 'Pricing', to: '/#pricing' },
  { label: 'FAQ', to: '/#faq' },
  { label: 'Docs', to: '/docs', section: 'Documentation' },
  { label: 'API', to: '/api', section: 'API reference' }
]

const repository = 'https://github.com/florian-strasser/LokalTransfer'

const route = useRoute()

// The documentation menus, so the small-screen sheet can carry them where there
// is no room for the sidebar. Awaited so they are in the server-rendered HTML.
const { sections, isCurrent, ready } = useDocsNavigation()
await ready

const pagesOf = (title: string) =>
  sections.value.find(section => section.title === title)?.items ?? []

// Highlighted for every page inside a section, not just its index.
const isSection = (to: string) => route.path.startsWith(to)

// One submenu open at a time, and the one you are reading opens itself — worked
// out each time the menu opens rather than once. This header lives in app.vue and
// is never set up again as the reader moves between pages, so a value taken at
// setup would still be the page the visit started on.
const sectionOf = (path: string) =>
  path.startsWith('/api') ? 'API reference' : path.startsWith('/docs') ? 'Documentation' : null
const expanded = ref<string | null>(sectionOf(route.path))
const toggle = (title: string) => {
  expanded.value = expanded.value === title ? null : title
}

const open = ref(false)

// Anything that changes the page closes the menu — including a link to a section
// of the page you are already on, which Vue Router does not report, hence the
// `@click` on every entry as well.
watch(() => route.fullPath, () => {
  open.value = false
})

const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') open.value = false
}

// Nothing behind the sheet moves while it is open. `stop()` halts Lenis, which is
// what scrolls the page; the page's bar is only painted transparent (see
// `menu-open` in main.css), so nothing shifts sideways.
const lenis = useLenis()
watch(open, (isOpen) => {
  if (isOpen) expanded.value = sectionOf(route.path)
  document.documentElement.classList.toggle('menu-open', isOpen)
  if (isOpen) lenis.value?.stop()
  else lenis.value?.start()
})

// The sheet and the burger are `md:hidden`, so widening the window past `md`
// hides them — but `open` would stay true, and the scroll lock with it. Crossing
// the line closes the menu, which is what the visitor sees happen anyway. 48rem
// is Tailwind's `md`; a media query cannot read the utility.
let desktop: MediaQueryList | undefined
const closeOnDesktop = (event: MediaQueryList | MediaQueryListEvent) => {
  if (event.matches) open.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  desktop = window.matchMedia('(min-width: 48rem)')
  desktop.addEventListener('change', closeOnDesktop)
  closeOnDesktop(desktop)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  desktop?.removeEventListener('change', closeOnDesktop)
  document.documentElement.classList.remove('menu-open')
  lenis.value?.start()
})
</script>
