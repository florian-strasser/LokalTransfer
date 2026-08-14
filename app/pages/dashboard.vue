<script setup lang="ts">
const { t } = useI18n()
const { formatBytes, formatDate, formatDateTime, isExpired } = useFormat()
const notify = useNotify()

useSeoMeta({ title: t('dashboard.title') })

interface SentTransfer {
  id: number
  token: string
  subject: string | null
  status: 'draft' | 'sent'
  kind: 'outgoing' | 'guest'
  expiresAt: string | null
  downloadCount: number
  createdAt: string
  sentAt: string | null
  fileCount: number
  totalSize: number
  recipients: string | null
  hasPassword: boolean
}

interface ReceivedTransfer {
  id: number
  token: string
  subject: string | null
  senderName: string
  senderEmail: string
  expiresAt: string | null
  sentAt: string | null
  fileCount: number
  totalSize: number
}

const { data, refresh } = await useFetch<{
  data: { sent: SentTransfer[], received: ReceivedTransfer[] }
}>('/api/transfers')

const sent = computed(() => data.value?.data.sent || [])
const received = computed(() => data.value?.data.received || [])

const tab = ref('sent')

function downloadUrl(token: string) {
  return `/d/${token}`
}

async function copyLink(token: string) {
  await navigator.clipboard.writeText(`${window.location.origin}/d/${token}`)
  notify.success(t('dashboard.linkCopied'))
}

const deletingId = ref<number | null>(null)

async function remove(transfer: SentTransfer) {
  if (!window.confirm(t('dashboard.deleteConfirm'))) return

  deletingId.value = transfer.id
  try {
    await $fetch(`/api/transfers/${transfer.id}`, { method: 'DELETE' })
    notify.success(t('dashboard.deleted'))
    await refresh()
  } catch {
    notify.error(t('common.unknownError'))
  } finally {
    deletingId.value = null
  }
}

/** The one-line status shown under each sent transfer. */
function expiryLabel(transfer: SentTransfer | ReceivedTransfer): string {
  if (!transfer.expiresAt) return t('dashboard.expiresNever')
  if (isExpired(transfer.expiresAt)) return t('dashboard.expired')
  return t('dashboard.expires', { date: formatDateTime(transfer.expiresAt) })
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="text-2xl font-semibold text-highlighted">
        {{ t('dashboard.title') }}
      </h1>

      <UButton
        to="/transfers/new"
        :label="t('dashboard.newTransfer')"
        icon="i-lucide-plus"
      />
    </div>

    <UTabs
      v-model="tab"
      :items="[
        { label: t('dashboard.sent'), value: 'sent', icon: 'i-lucide-send' },
        { label: t('dashboard.received'), value: 'received', icon: 'i-lucide-inbox' }
      ]"
      :ui="{
        root: 'gap-6',
        // These tabs sit directly on the grey page, not inside a tile. The stock
        // `bg-elevated` track is nearly the page colour there, leaving the
        // control with no visible edge — so it takes the tile colour instead.
        list: 'bg-default'
      }"
    >
      <template #content="{ item }">
        <!-- Sent -->
        <div v-if="item.value === 'sent'">
          <UCard v-if="!sent.length">
            <p class="py-8 text-center text-muted">
              {{ t('dashboard.empty') }}
            </p>
          </UCard>

          <ul
            v-else
            class="space-y-3"
          >
            <li
              v-for="transfer in sent"
              :key="transfer.id"
            >
              <UCard :ui="{ body: 'sm:p-5' }">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="font-medium text-highlighted truncate">
                        {{ transfer.subject || t('dashboard.files', { count: transfer.fileCount }, transfer.fileCount) }}
                      </h3>

                      <UBadge
                        v-if="transfer.status === 'draft'"
                        :label="t('dashboard.draft')"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                      />
                      <!-- No recipients means the sender is passing the link on
                           themselves, which is worth showing: nothing was mailed. -->
                      <UBadge
                        v-else-if="!transfer.recipients"
                        :label="t('dashboard.linkOnly')"
                        icon="i-lucide-link"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                      />
                      <UBadge
                        v-if="transfer.hasPassword"
                        :label="t('dashboard.protected')"
                        icon="i-lucide-lock"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                      />
                      <UBadge
                        v-else-if="isExpired(transfer.expiresAt)"
                        :label="t('dashboard.expired')"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                      />
                    </div>

                    <p
                      v-if="transfer.recipients"
                      class="mt-1 truncate text-sm text-muted"
                    >
                      {{ t('dashboard.recipients') }}: {{ transfer.recipients }}
                    </p>

                    <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dimmed">
                      <span>{{ formatDate(transfer.sentAt || transfer.createdAt) }}</span>
                      <span>{{ t('dashboard.files', { count: transfer.fileCount }, transfer.fileCount) }} · {{ formatBytes(transfer.totalSize) }}</span>
                      <span>{{ t('dashboard.downloads', { count: transfer.downloadCount }, transfer.downloadCount) }}</span>
                      <span>{{ expiryLabel(transfer) }}</span>
                    </div>
                  </div>

                  <div class="flex shrink-0 items-center gap-1">
                    <UButton
                      v-if="transfer.status === 'sent' && !isExpired(transfer.expiresAt)"
                      :to="downloadUrl(transfer.token)"
                      icon="i-lucide-external-link"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :aria-label="t('download.downloadFile')"
                    />
                    <UButton
                      v-if="transfer.status === 'sent' && !isExpired(transfer.expiresAt)"
                      icon="i-lucide-copy"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :aria-label="t('dashboard.copyLink')"
                      @click="copyLink(transfer.token)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :loading="deletingId === transfer.id"
                      :aria-label="t('dashboard.deleteTransfer')"
                      @click="remove(transfer)"
                    />
                  </div>
                </div>
              </UCard>
            </li>
          </ul>
        </div>

        <!-- Received -->
        <div v-else>
          <UCard v-if="!received.length">
            <p class="py-8 text-center text-muted">
              {{ t('dashboard.emptyReceived') }}
            </p>
          </UCard>

          <ul
            v-else
            class="space-y-3"
          >
            <li
              v-for="transfer in received"
              :key="transfer.id"
            >
              <UCard :ui="{ body: 'sm:p-5' }">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div class="min-w-0 flex-1">
                    <h3 class="font-medium text-highlighted truncate">
                      {{ transfer.subject || t('dashboard.files', { count: transfer.fileCount }, transfer.fileCount) }}
                    </h3>

                    <p class="mt-1 truncate text-sm text-muted">
                      {{ t('dashboard.from') }}: {{ transfer.senderName }} ({{ transfer.senderEmail }})
                    </p>

                    <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dimmed">
                      <span>{{ formatDate(transfer.sentAt) }}</span>
                      <span>{{ t('dashboard.files', { count: transfer.fileCount }, transfer.fileCount) }} · {{ formatBytes(transfer.totalSize) }}</span>
                      <span>{{ expiryLabel(transfer) }}</span>
                    </div>
                  </div>

                  <UButton
                    v-if="!isExpired(transfer.expiresAt)"
                    :to="downloadUrl(transfer.token)"
                    :label="t('download.downloadFile')"
                    icon="i-lucide-download"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    class="shrink-0"
                  />
                </div>
              </UCard>
            </li>
          </ul>
        </div>
      </template>
    </UTabs>
  </div>
</template>
