<script setup lang="ts">
// A labelled form field: the label, an optional description under it, then the
// control. Rendered as a <label> by default — LokalBoards' InputField does the
// same — so clicking the words focuses the field without any ids to wire.
//
// A field whose content is more than one control (a set of radios, a checkbox,
// a dropzone) passes `as="div"`: a label may only label one thing, and nesting
// the checkbox's own label inside this one would be invalid.
withDefaults(defineProps<{
  label?: string
  description?: string
  help?: string
  required?: boolean
  as?: 'label' | 'div'
}>(), { label: undefined, description: undefined, help: undefined, required: false, as: 'label' })
</script>

<template>
  <component
    :is="as"
    class="block"
  >
    <span
      v-if="label"
      class="block text-sm font-medium text-default"
    >
      {{ label }}<span
        v-if="required"
        class="ml-0.5 text-primary"
        aria-hidden="true"
      >*</span>
    </span>
    <span
      v-if="description"
      class="block text-sm text-muted"
    >{{ description }}</span>
    <div :class="{ 'mt-1.5': label || description }">
      <slot />
    </div>
    <span
      v-if="help"
      class="mt-1.5 block text-sm text-muted"
    >{{ help }}</span>
  </component>
</template>
