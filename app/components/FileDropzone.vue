<script setup lang="ts">
import type { QueuedFile } from '~/composables/useTransferUpload'

const props = defineProps<{
  files: QueuedFile[]
  maxFiles: number
  maxFileSizeMb: number
  disabled?: boolean
  /** Tighter padding and a scrolling file list, for the composer widget. */
  compact?: boolean
}>()

const emit = defineEmits<{
  add: [files: FileList | File[]]
  remove: [id: string]
}>()

const { t } = useI18n()
const { formatBytes } = useFormat()

const input = ref<HTMLInputElement | null>(null)

// Drag events fire for every child element the pointer crosses, so a plain
// boolean would flicker as the cursor moves over the file list inside the zone.
// Counting enter/leave pairs tracks whether the pointer is still anywhere within.
const dragDepth = ref(0)
const isDragging = computed(() => dragDepth.value > 0)

function onDrop(event: DragEvent) {
  dragDepth.value = 0
  if (props.disabled) return

  const dropped = event.dataTransfer?.files
  if (dropped?.length) emit('add', dropped)
}

function onSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.length) emit('add', target.files)
  // Cleared so picking the same file again still fires a change event.
  target.value = ''
}

const totalSize = computed(() => props.files.reduce((sum, item) => sum + item.file.size, 0))
</script>

<template>
  <div>
    <div
      class="rounded-lg border-2 border-dashed border-default transition-colors"
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
      <div
        class="text-center"
        :class="compact ? 'px-4 py-6' : 'px-6 py-10'"
      >
        <UIcon
          name="i-lucide-upload-cloud"
          :class="compact ? 'size-6 text-dimmed' : 'size-8 text-dimmed'"
        />
        <p
          class="font-medium text-default"
          :class="compact ? 'mt-2 text-sm' : 'mt-3'"
        >
          {{ t('compose.dropzone') }}
        </p>
        <p
          class="mt-1 text-muted"
          :class="compact ? 'text-xs' : 'text-sm'"
        >
          {{ t('compose.dropzoneHint', { count: maxFiles, size: `${maxFileSizeMb} MB` }) }}
        </p>
      </div>

      <input
        ref="input"
        type="file"
        multiple
        class="hidden"
        :disabled="disabled"
        @change="onSelect"
      >
    </div>

    <div
      v-if="files.length"
      class="mt-4"
    >
      <ul
        class="divide-y divide-default rounded-lg border border-default"
        :class="compact ? 'max-h-56 overflow-y-auto' : ''"
      >
        <li
          v-for="item in files"
          :key="item.id"
          class="flex items-center gap-3"
          :class="compact ? 'px-3 py-2' : 'px-4 py-3'"
        >
          <UIcon
            :name="item.status === 'done'
              ? 'i-lucide-circle-check'
              : item.status === 'error'
                ? 'i-lucide-circle-alert'
                : 'i-lucide-file'"
            class="size-5 shrink-0"
            :class="item.status === 'done' ? 'text-primary' : 'text-dimmed'"
          />

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-default">
              {{ item.file.name }}
            </p>

            <p
              v-if="item.error"
              class="text-xs text-primary"
            >
              {{ item.error }}
            </p>
            <p
              v-else
              class="text-xs text-muted"
            >
              {{ formatBytes(item.file.size) }}
            </p>

            <!-- Only while this file is actually in flight; a finished or
                 not-yet-started file has nothing to report. -->
            <UProgress
              v-if="item.status === 'uploading'"
              :model-value="item.progress"
              size="xs"
              class="mt-2"
            />
          </div>

          <UButton
            v-if="!disabled"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="t('compose.removeFile')"
            @click.stop="emit('remove', item.id)"
          />
        </li>
      </ul>

      <div class="mt-3 flex items-center justify-between text-sm text-muted">
        <span>{{ t('compose.totalSize', { count: files.length, size: formatBytes(totalSize) }, files.length) }}</span>
        <UButton
          v-if="!disabled"
          :label="t('compose.addMore')"
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="input?.click()"
        />
      </div>
    </div>
  </div>
</template>
