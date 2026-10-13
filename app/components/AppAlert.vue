<script setup lang="ts">
import type { Component } from 'vue'
import { CircleAlert } from '@lucide/vue'

// LokalBoards' ErrorMessage, in the accent tint, sized to sit inside a form.
// Used for confirmations as well as failures — a sent link, an expired one —
// which is why the icon is the caller's: the wording and the icon say which it
// is, never a second colour.
withDefaults(defineProps<{
  description?: string
  icon?: Component
}>(), { description: undefined, icon: () => CircleAlert })
</script>

<template>
  <div class="flex gap-2.5 rounded-lg bg-primary/10 p-4 text-sm text-primary ring-1 ring-inset ring-primary/25">
    <component
      :is="icon"
      class="size-5 shrink-0"
      aria-hidden="true"
    />
    <div class="min-w-0 flex-1 pt-px">
      <slot>{{ description }}</slot>
    </div>
  </div>
</template>
