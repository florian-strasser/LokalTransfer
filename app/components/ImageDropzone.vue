<script setup lang="ts">
import { ImageIcon, X } from '@lucide/vue'

// A drag-and-drop field for one image: a transfer's background in the composer,
// and a member's default background on the account page.
//
// Separate from FileDropzone rather than a variant of it: that one manages a
// queue of uploads with progress and per-file errors, while this holds exactly
// one file and shows it. Sharing them would mean a component that does neither
// job cleanly.
const props = defineProps<{
  modelValue: File | null
  disabled?: boolean
  /** Shown when nothing is chosen yet. */
  label: string
  hint?: string
  removeLabel: string
  /** An image already in place — a member's saved default — shown while nothing
      has been picked here. Removing it emits `remove` rather than clearing the
      model, since there is no file to clear. */
  src?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [file: File | null]
  'remove': []
}>()

const input = ref<HTMLInputElement | null>(null)

// Drag events fire for every child the pointer crosses, so a plain boolean would
// flicker as the cursor moves over the preview inside the zone. Counting
// enter/leave pairs tracks whether the pointer is still anywhere within.
const dragDepth = ref(0)
const isDragging = computed(() => dragDepth.value > 0)

// Held here rather than by the parent so the object URL is revoked when this
// component goes away — an object URL that outlives its component leaks the
// whole file until the tab is closed.
const preview = ref<string | null>(null)

function setPreview(file: File | null) {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = file ? URL.createObjectURL(file) : null
}

// Kept in step with the parent, which clears the selection after a send.
watch(() => props.modelValue, file => setPreview(file), { immediate: true })
onBeforeUnmount(() => setPreview(null))

// A file picked here outranks the image already in place, which shows through
// again once the pick is removed.
const shown = computed(() => preview.value ?? props.src ?? null)

function accept(file: File | undefined) {
  if (props.disabled || !file) return
  // Anything that isn't an image is ignored rather than reported: the server
  // sniffs the bytes and would reject it anyway, and a dropped PDF here is a
  // slip, not something worth an error message.
  if (!file.type.startsWith('image/')) return
  emit('update:modelValue', file)
}

function onDrop(event: DragEvent) {
  dragDepth.value = 0
  accept(event.dataTransfer?.files?.[0])
}

function onSelect(event: Event) {
  const target = event.target as HTMLInputElement
  accept(target.files?.[0])
  // Cleared so choosing the same file again still fires a change event.
  target.value = ''
}

function clear() {
  if (props.modelValue) emit('update:modelValue', null)
  else emit('remove')
  if (input.value) input.value.value = ''
}
</script>

<template>
  <div
    class="relative overflow-hidden rounded-lg border-2 border-dashed border-default transition-colors"
    :class="[
      isDragging && !disabled ? 'dropzone-active' : '',
      disabled ? 'opacity-60' : 'cursor-pointer hover:border-accented'
    ]"
    @dragenter.prevent="dragDepth++"
    @dragleave.prevent="dragDepth--"
    @dragover.prevent
    @drop.prevent="onDrop"
    @click="!disabled && input?.click()"
  >
    <!-- Once an image is chosen it *is* the field: a thumbnail beside a button
         says less about what the recipient will see than the picture itself. -->
    <div
      v-if="shown"
      class="relative"
    >
      <img
        :src="shown"
        alt=""
        class="block h-28 w-full object-cover"
      >
      <AppButton
        v-if="!disabled"
        :icon="X"
        color="neutral"
        variant="solid"
        size="xs"
        class="absolute right-2 top-2"
        :aria-label="removeLabel"
        @click.stop="clear"
      />
    </div>

    <div
      v-else
      class="px-4 py-5 text-center"
    >
      <ImageIcon
        class="mx-auto size-6 text-dimmed"
        aria-hidden="true"
      />
      <p class="mt-2 text-sm font-medium text-default">
        {{ label }}
      </p>
      <p
        v-if="hint"
        class="mt-1 text-xs text-muted"
      >
        {{ hint }}
      </p>
    </div>

    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
      class="hidden"
      :disabled="disabled"
      @change="onSelect"
    >
  </div>
</template>
