<script setup lang="ts">
// The public download page. No account, no session — the token in the URL is the
// credential, because recipients are people who have never heard of this app.
//
// Three states: not found / expired, locked behind a password, and unlocked. The
// locked state is served the presentation shell only (layout, background), never
// the file list — a list of filenames is often as revealing as the files.
// `align: 'right'` puts the card against the right edge instead of centring it,
// leaving the rest of the viewport to the background image — the whole point of
// the per-transfer background.
definePageMeta({ layout: 'blank', align: 'right' })

const { t } = useI18n()
const route = useRoute()
const { formatBytes, formatDateTime } = useFormat()
const { apiErrorMessage } = useApiError()

interface DownloadFile {
  id: number
  filename: string
  size: number
  /** Decided by the file's own bytes on the server, not its name or declared type. */
  isImage: boolean
}

interface DownloadData {
  layout: 'list' | 'gallery'
  hasBackground: boolean
  requiresPassword: boolean
  locked: boolean
  senderName?: string
  subject?: string | null
  message?: string | null
  sentAt?: string
  expiresAt?: string | null
  totalSize?: number
  files?: DownloadFile[]
}

const token = String(route.params.token)

// An expired, deleted or never-existent token all come back as a 404 and land in
// the same "no longer valid" state, which is what the API intends — a stranger
// holding an old link learns nothing about what used to be there.
const { data, error, refresh } = await useFetch<{ data: DownloadData }>(
  `/api/download/${token}`
)

const transfer = computed(() => data.value?.data)
const files = computed(() => transfer.value?.files || [])
const isGallery = computed(() => transfer.value?.layout === 'gallery')

useSeoMeta({
  title: t('download.title'),
  // Belt and braces alongside the global noindex: a download link should never
  // end up in a search index.
  robots: 'noindex, nofollow'
})

const backgroundSrc = computed(() =>
  (transfer.value?.hasBackground ? `/api/download/${token}/background` : null))

function fileUrl(fileId: number) {
  return `/api/download/${token}/file/${fileId}`
}

function previewUrl(fileId: number) {
  return `/api/download/${token}/preview/${fileId}`
}

const zipUrl = computed(() => `/api/download/${token}/zip`)

// --- Password gate -----------------------------------------------------------
const password = ref('')
const unlocking = ref(false)
const unlockError = ref<string | null>(null)

async function unlock() {
  unlocking.value = true
  unlockError.value = null

  try {
    await $fetch(`/api/download/${token}/unlock`, {
      method: 'POST',
      body: { password: password.value }
    })
    password.value = ''
    // The cookie is set; re-fetching now returns the real contents.
    await refresh()
  } catch (err) {
    unlockError.value = apiErrorMessage(err, 'download.errors')
  } finally {
    unlocking.value = false
  }
}

// Images lead the gallery; anything else is listed underneath, since a grid of
// generic file icons helps nobody.
const galleryImages = computed(() => files.value.filter(file => file.isImage))
const otherFiles = computed(() => files.value.filter(file => !file.isImage))
</script>

<template>
  <div>
    <!-- No wash over the image: nothing on this page sits outside the card, so
         there is no text to protect, and the sender picked the photograph to be
         seen rather than faded to grey. -->
    <AppBackground
      :src="backgroundSrc"
      :scrim="false"
    />

    <!-- Not found / expired ------------------------------------------------ -->
    <div
      v-if="error || !transfer"
      class="max-w-md rounded-2xl border border-default bg-default p-8 text-center shadow-xl"
    >
      <UIcon
        name="i-lucide-link-2-off"
        class="size-10 text-dimmed"
      />
      <h1 class="mt-3 text-xl font-semibold text-highlighted">
        {{ t('download.notFound') }}
      </h1>
      <p class="mx-auto mt-2 max-w-sm text-muted">
        {{ t('download.notFoundHint') }}
      </p>
    </div>

    <!-- Locked -------------------------------------------------------------- -->
    <div
      v-else-if="transfer.locked"
      class="max-w-sm rounded-2xl border border-default bg-default p-8 shadow-xl"
    >
      <div class="text-center">
        <UIcon
          name="i-lucide-lock"
          class="size-9 text-dimmed"
        />
        <h1 class="mt-3 text-lg font-semibold text-highlighted">
          {{ t('download.locked') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('download.lockedHint') }}
        </p>
      </div>

      <form
        class="mt-6 space-y-3"
        @submit.prevent="unlock"
      >
        <UInput
          v-model="password"
          type="password"
          autocomplete="off"
          autofocus
          :placeholder="t('download.password')"
          class="w-full"
        />

        <UAlert
          v-if="unlockError"
          icon="i-lucide-circle-alert"
          variant="subtle"
          :description="unlockError"
        />

        <UButton
          type="submit"
          :label="t('download.unlock')"
          :loading="unlocking"
          :disabled="!password"
          block
          size="lg"
        />
      </form>
    </div>

    <!-- Unlocked ------------------------------------------------------------ -->
    <div
      v-else
      :class="isGallery ? 'max-w-5xl' : 'max-w-xl'"
    >
      <div class="rounded-2xl border border-default bg-default shadow-xl">
        <div class="space-y-4 p-6 sm:p-8">
          <!-- Inside the card and above the title. It used to sit underneath on
               the page itself, where it was unreadable the moment the sender
               configured a dark background — and no fixed text colour survives
               an arbitrary photograph. Leading with it also puts the deadline
               first, which is the thing a recipient has to act on. -->
          <p class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <UIcon
              name="i-lucide-clock"
              class="size-4 shrink-0"
            />
            <template v-if="transfer.expiresAt">
              {{ t('download.expires', { date: formatDateTime(transfer.expiresAt) }) }}
            </template>
            <template v-else>
              {{ t('download.expiresNever') }}
            </template>
          </p>

          <div>
            <h1 class="text-2xl font-semibold text-highlighted">
              {{ transfer.subject || t('download.title') }}
            </h1>
            <p class="mt-1 text-muted">
              {{ t('download.from', {
                sender: transfer.senderName,
                count: files.length
              }, files.length) }}
            </p>
          </div>

          <p
            v-if="transfer.message"
            class="whitespace-pre-line rounded-lg bg-elevated px-4 py-3 text-default"
          >
            {{ transfer.message }}
          </p>

          <div class="flex flex-wrap items-center justify-between gap-3">
            <span class="text-sm text-muted">
              {{ t('download.totalSize', {
                count: files.length,
                size: formatBytes(transfer.totalSize || 0)
              }, files.length) }}
            </span>

            <UButton
              v-if="files.length > 1"
              :to="zipUrl"
              external
              :label="t('download.downloadAll')"
              icon="i-lucide-folder-archive"
            />
          </div>
        </div>

        <!-- Gallery ------------------------------------------------------- -->
        <div
          v-if="isGallery && galleryImages.length"
          class="border-t border-default p-6 sm:p-8"
        >
          <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <li
              v-for="file in galleryImages"
              :key="file.id"
              class="group relative overflow-hidden rounded-lg bg-elevated"
            >
              <!-- The whole tile is the download link; the caption overlay only
                   appears on hover or focus so it doesn't cover the picture. -->
              <a
                :href="fileUrl(file.id)"
                class="block focus:outline-none"
                :aria-label="`${t('download.downloadFile')}: ${file.filename}`"
              >
                <img
                  :src="previewUrl(file.id)"
                  :alt="file.filename"
                  loading="lazy"
                  decoding="async"
                  class="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-105"
                >
                <span
                  class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <span class="truncate">{{ file.filename }}</span>
                  <UIcon
                    name="i-lucide-download"
                    class="size-4 shrink-0"
                  />
                </span>
              </a>
            </li>
          </ul>
        </div>

        <!-- List (also the fallback for non-image files in a gallery) ------ -->
        <div
          v-if="!isGallery || otherFiles.length"
          class="border-t border-default p-6 sm:p-8"
        >
          <p
            v-if="isGallery"
            class="mb-3 text-sm font-medium text-muted"
          >
            {{ t('download.otherFiles') }}
          </p>

          <ul class="divide-y divide-default">
            <li
              v-for="file in (isGallery ? otherFiles : files)"
              :key="file.id"
              class="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <UIcon
                name="i-lucide-file"
                class="size-5 shrink-0 text-dimmed"
              />

              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-default">
                  {{ file.filename }}
                </p>
                <p class="text-xs text-muted">
                  {{ formatBytes(file.size) }}
                </p>
              </div>

              <UButton
                :to="fileUrl(file.id)"
                external
                icon="i-lucide-download"
                color="neutral"
                variant="subtle"
                size="sm"
                :aria-label="`${t('download.downloadFile')}: ${file.filename}`"
              />
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
