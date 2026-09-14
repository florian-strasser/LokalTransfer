<template>
  <!-- A sticky column beside the article on a wide screen, and nothing below
       `md`: there the same sections live in the header's menu, which opens over
       the page from anywhere. A second, collapsible copy above every article
       was one menu too many. -->
  <nav
    class="hidden w-full shrink-0 md:block md:w-60 md:sticky md:top-24"
    :aria-label="label"
  >
    <SideNavSections
      :sections="sections"
      :is-current="isCurrent"
    />
  </nav>
</template>

<script setup lang="ts">
import type { NavItem } from './SideNavSections.vue'

defineProps<{
  sections: { title: string, to: string, items: NavItem[] }[]
  isCurrent: (path: string) => boolean
  label: string
}>()
</script>
