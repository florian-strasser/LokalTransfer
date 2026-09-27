<script setup lang="ts" generic="T extends string | number">
import { Check } from 'lucide-vue-next'

// LokalBoards' select menu: a button styled as a form field, and a list under
// it. Ported with one addition, `multiple`, for picking several colleagues as
// recipients in the composer — there the list stays open while ticking, and
// the button reads the chosen names back.
//
// For a single choice with no need for a styled list, a native
// `<select class="form-control">` is the lighter tool and is used instead.
// `description` is a second line under the label — the composer shows each
// colleague's address there, so a guest can see where the files will go.
type Option = { label: string, value: T, description?: string }

const props = defineProps<{
  options: Option[]
  multiple?: boolean
  placeholder?: string
  disabled?: boolean
}>()

const model = defineModel<T | T[] | undefined>()
const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')

const isSelected = (value: T) =>
  Array.isArray(model.value) ? model.value.includes(value) : model.value === value

function select(value: T) {
  if (props.multiple) {
    const current = Array.isArray(model.value) ? model.value : []
    model.value = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    return
  }
  model.value = value
  open.value = false
}

const selectedLabel = computed(() =>
  props.options
    .filter(option => isSelected(option.value))
    .map(option => option.label)
    .join(', '))

// Closed by a press anywhere outside it, and by Escape for keyboard users.
//
// LokalBoards closes it with a full-screen catcher behind the list instead. That
// relies on `position: fixed` meaning the viewport, which it stops meaning
// inside anything with a `backdrop-filter` — the composer floats over the
// background photograph on exactly such a card, and the catcher shrank to the
// card's size, so a click beside it left the menu open.
const onPointerDown = (event: PointerEvent) => {
  if (open.value && !root.value?.contains(event.target as Node)) open.value = false
}
const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div
    ref="root"
    class="relative"
  >
    <button
      type="button"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      class="form-control form-control-select w-full cursor-pointer truncate text-left"
      @click="open = !open"
    >
      <span
        v-if="selectedLabel"
        class="truncate"
      >{{ selectedLabel }}</span>
      <span
        v-else
        class="truncate text-muted"
      >{{ placeholder }}</span>
    </button>

    <ul
      v-if="open"
      role="listbox"
      :aria-multiselectable="multiple || undefined"
      class="absolute inset-x-0 z-20 mt-1 max-h-64 overflow-auto rounded-[0.625rem] border border-default bg-default py-1 shadow-lg"
    >
      <li
        v-for="option in options"
        :key="option.value"
      >
        <button
          type="button"
          role="option"
          :aria-selected="isSelected(option.value)"
          class="flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition-colors hover:bg-primary/10"
          :class="isSelected(option.value) ? 'font-medium text-primary' : 'text-highlighted'"
          @click="select(option.value)"
        >
          <span class="min-w-0">
            <span class="block truncate">{{ option.label }}</span>
            <span
              v-if="option.description"
              class="block truncate text-xs font-normal text-muted"
            >{{ option.description }}</span>
          </span>
          <Check
            v-if="isSelected(option.value)"
            class="size-4 shrink-0"
          />
        </button>
      </li>
    </ul>
  </div>
</template>
