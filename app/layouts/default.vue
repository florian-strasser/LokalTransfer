<script setup lang="ts">
import type { Component } from 'vue'
import { Inbox, LogOut, Upload, UserRoundPen, Users } from 'lucide-vue-next'

// The shell for every signed-in page. Public pages (sign-in, download) use the
// `blank` layout instead, because a navigation bar full of links a stranger
// can't open is worse than no navigation at all.
// `user` is deliberately not pulled in: the nav is icon-only now, so the signed-in
// name has nowhere to live here. It is shown on the account page instead — the
// same trade LokalBoards makes.
const { signOut, isAdmin } = useAuth()
const { t } = useI18n()
const route = useRoute()
// Resolved here: a component named by string in `:is` is looked up among the
// globally registered ones, and NuxtLink is auto-imported rather than global.
const NuxtLink = resolveComponent('NuxtLink')
// Read during setup, where the Nuxt context useState needs is available.
const appName = useSettings().value.appName

// One flat list of icon actions, the way LokalBoards does it: no dropdown, every
// destination one click away. Labels live in tooltips rather than beside the
// icons, so the pill stays compact and reads as a single object.
//
// `signOut` is an action rather than a route, hence the optional `onSelect`.
interface NavAction {
  label: string
  icon: Component
  to?: string
  onSelect?: () => void
}

const actions = computed<NavAction[]>(() => {
  const items: NavAction[] = [
    { label: t('nav.dashboard'), icon: Inbox, to: '/dashboard' },
    { label: t('nav.newTransfer'), icon: Upload, to: '/transfers/new' }
  ]

  if (isAdmin.value) {
    items.push({ label: t('nav.users'), icon: Users, to: '/users' })
  }

  items.push(
    { label: t('nav.account'), icon: UserRoundPen, to: '/account' },
    { label: t('common.signOut'), icon: LogOut, onSelect: () => signOut() }
  )

  return items
})

// The section you are in, so /users/42 still lights up "Users".
const isActive = (to?: string) =>
  !!to && (route.path === to || route.path.startsWith(`${to}/`))
</script>

<template>
  <!-- No background colour on this root: main.css already paints the page on
       <body>, and an opaque background here would be painted *after* the fixed
       AppBackground layer (which sits at a negative z-index inside the same
       stacking context), hiding the image entirely. -->
  <div class="min-h-screen">
    <!-- The header itself is transparent — it sits on the page rather than
         reading as a separate bar, and is not sticky (a transparent bar that
         stayed put would let content scroll visibly through the navigation).
         The actions carry their own white surface instead, as a pill. -->
    <header>
      <div class="mx-auto max-w-5xl px-4 sm:px-6">
        <div class="flex h-20 items-center justify-between gap-4">
          <!-- Mark only, no wordmark — the same treatment as the nav, and as
               LokalBoards. `h-11` is the nav pill's own height (44px), so the two
               ends of the header read as one row rather than one floating above
               the other.
               The app name moves into the SVG's <title>, which is what gives this
               link its accessible name now that there is no visible text. -->
          <NuxtLink
            to="/dashboard"
            class="shrink-0 text-primary transition-opacity hover:opacity-80"
          >
            <AppLogo
              class="h-11 w-auto"
              :title="appName"
            />
          </NuxtLink>

          <!-- The pill: `bg-default` is the tile colour, so it lifts off the grey
               page exactly like a card does. It is also what makes the hover
               state legible — a hover fill landing on the page grey would be
               nearly the same colour as the page.
               The icons are LokalBoards' header buttons: grey at rest, the
               accent and its tint when pointed at or when they are the page
               you are on. -->
          <nav
            class="flex items-center gap-0.5 rounded-full bg-default px-2 py-1.5 sm:gap-1 sm:px-3"
          >
            <component
              :is="action.to ? NuxtLink : 'button'"
              v-for="action in actions"
              :key="action.label"
              v-tooltip="action.label"
              :to="action.to"
              :type="action.to ? undefined : 'button'"
              :aria-label="action.label"
              :aria-current="isActive(action.to) ? 'page' : undefined"
              class="flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :class="isActive(action.to) ? 'text-primary' : 'text-default'"
              @click="action.onSelect?.()"
            >
              <component
                :is="action.icon"
                class="size-5"
                aria-hidden="true"
              />
            </component>
          </nav>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <slot />
    </main>
  </div>
</template>
