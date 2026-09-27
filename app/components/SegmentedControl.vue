<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'

// LokalBoards' segmented toggle: a styled radio group whose checked option is a
// filled pill. It is the control and nothing else — whatever each option
// switches between is rendered by the caller, under a plain `v-if`.
//
// Two additions over LokalBoards: an optional icon per option, and `disabled`,
// for the composer, which locks its delivery choice while an upload runs.
//
// The track is a tint rather than a colour, so it shows wherever it is put: a
// step darker than a white tile, and a step darker than the grey page too. Tabs
// sitting on the page used to need a different track from tabs inside a card.
defineProps<{
  items: { label: string, value: T, icon?: Component }[]
  disabled?: boolean
}>()

const model = defineModel<T>({ required: true })
// Every instance its own radio group, or two of them on one page would share
// a selection.
const name = useId()
</script>

<template>
  <div
    class="flex w-full gap-1 rounded-lg bg-black/[0.06] p-1 dark:bg-white/10"
    :class="{ 'opacity-75': disabled }"
  >
    <label
      v-for="item in items"
      :key="item.value"
      class="min-w-0 flex-1"
      :class="disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
    >
      <input
        v-model="model"
        type="radio"
        :name="name"
        :value="item.value"
        :disabled="disabled"
        class="peer sr-only"
      >
      <span
        class="flex select-none items-center justify-center gap-1.5 truncate rounded-md px-4 py-1.5 text-center text-sm font-medium text-muted transition-colors peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
      >
        <component
          :is="item.icon"
          v-if="item.icon"
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        <span class="truncate">{{ item.label }}</span>
      </span>
    </label>
  </div>
</template>
