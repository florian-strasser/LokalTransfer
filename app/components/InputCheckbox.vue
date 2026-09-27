<script setup lang="ts">
// LokalBoards' checkbox: a native input drawn over, so it keeps the keyboard,
// the form semantics and forced-colours support, with the tick as an SVG on
// top. Ported with a `description` line under the label.
defineProps<{
  label: string
  description?: string
  disabled?: boolean
}>()

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label
    class="flex gap-x-2.5"
    :class="disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
  >
    <div class="group mt-0.5 grid size-5 shrink-0 grow-0 grid-cols-1">
      <input
        v-model="model"
        type="checkbox"
        :disabled="disabled"
        class="col-start-1 row-start-1 appearance-none rounded-sm border border-accented bg-default checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 forced-colors:appearance-auto"
      >
      <svg
        viewBox="0 0 14 14"
        fill="none"
        class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white"
        aria-hidden="true"
      >
        <path
          d="M3 8L6 11L11 3.5"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="opacity-0 group-has-checked:opacity-100"
        />
      </svg>
    </div>
    <div class="min-w-0 grow text-sm">
      <span class="block font-medium text-default">{{ label }}</span>
      <span
        v-if="description"
        class="block text-muted"
      >{{ description }}</span>
    </div>
  </label>
</template>
