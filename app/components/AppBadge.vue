<script setup lang="ts">
import type { Component } from 'vue'

// A small tag — a role, a state, a count. Neutral by default: the one accent is
// kept for what should stand out, like an administrator in the user list.
withDefaults(defineProps<{
  label?: string
  icon?: Component
  color?: 'neutral' | 'primary'
}>(), { label: undefined, icon: undefined, color: 'neutral' })
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset"
    :class="color === 'primary' ? 'bg-primary/10 text-primary ring-primary/25' : 'bg-elevated text-default ring-accented'"
  >
    <component
      :is="icon"
      v-if="icon"
      class="size-3.5 shrink-0"
      aria-hidden="true"
    />
    <slot>{{ label }}</slot>
  </span>
</template>
