<script setup lang="ts">
// The shell for every signed-in page. Public pages (sign-in, download) use the
// `blank` layout instead, because a navigation bar full of links a stranger
// can't open is worse than no navigation at all.
// `user` is deliberately not pulled in: the nav is icon-only now, so the signed-in
// name has nowhere to live here. It is shown on the account page instead — the
// same trade LokalBoards makes.
const { signOut, isAdmin } = useAuth()
const { t } = useI18n()
const config = useRuntimeConfig().public

const appName = String(config.appName || 'LokalTransfer')

// One flat list of icon actions, the way LokalBoards does it: no dropdown, every
// destination one click away. Labels live in tooltips rather than beside the
// icons, so the pill stays compact and reads as a single object.
//
// `signOut` is an action rather than a route, hence the optional `onSelect`.
interface NavAction {
  label: string
  icon: string
  to?: string
  onSelect?: () => void
}

const actions = computed<NavAction[]>(() => {
  const items: NavAction[] = [
    { label: t('nav.dashboard'), icon: 'i-lucide-inbox', to: '/dashboard' },
    { label: t('nav.newTransfer'), icon: 'i-lucide-upload', to: '/transfers/new' }
  ]

  if (isAdmin.value) {
    items.push({ label: t('nav.users'), icon: 'i-lucide-users', to: '/users' })
  }

  items.push(
    { label: t('nav.account'), icon: 'i-lucide-user-round-pen', to: '/account' },
    { label: t('common.signOut'), icon: 'i-lucide-log-out', onSelect: () => signOut() }
  )

  return items
})
</script>

<template>
  <!-- No background colour on this root: Nuxt UI already paints `bg-default` on
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
               state legible again — a ghost button's hover fill was previously
               landing on the page grey, which is nearly the same colour. -->
          <nav
            class="flex items-center gap-0.5 rounded-full bg-default px-2 py-1.5 sm:gap-1 sm:px-3"
          >
            <UTooltip
              v-for="action in actions"
              :key="action.label"
              :text="action.label"
            >
              <UButton
                :to="action.to"
                :icon="action.icon"
                color="neutral"
                variant="ghost"
                size="md"
                :ui="{ base: 'rounded-full' }"
                active-color="primary"
                :aria-label="action.label"
                @click="action.onSelect?.()"
              />
            </UTooltip>
          </nav>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <slot />
    </main>
  </div>
</template>
