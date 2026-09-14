<template>
  <div class="flex flex-col gap-6">
    <div
      v-for="section in sections"
      :key="section.to"
    >
      <NuxtLink
        :to="section.to"
        class="block text-xs font-semibold uppercase tracking-wider transition-colors"
        :class="isCurrent(section.to) ? 'text-primary' : 'text-gray hover:text-dark'"
      >
        {{ section.title }}
      </NuxtLink>

      <ul class="mt-2 flex flex-col gap-0.5 border-l border-slate">
        <li
          v-for="page in section.items"
          :key="page.path"
        >
          <NuxtLink
            :to="page.path"
            class="-ml-px block border-l py-1 pl-3 text-sm transition-colors"
            :class="isCurrent(page.path)
              ? 'border-primary font-medium text-primary'
              : 'border-transparent text-gray hover:border-gray/40 hover:text-dark'"
          >
            {{ page.title }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface NavItem {
  path: string
  title: string
}

defineProps<{
  sections: { title: string, to: string, items: NavItem[] }[]
  isCurrent: (path: string) => boolean
}>()
</script>
