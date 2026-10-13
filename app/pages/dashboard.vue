<script setup lang="ts">
import { Copy, Download, ExternalLink, Inbox, Link, LockIcon, Plus, Send, Trash2 } from '@lucide/vue'

const { t } = useI18n()
const { formatBytes, formatDate, formatDateTime, isExpired } = useFormat()
const notify = useNotify()
const copy = useCopy()

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
  await copy(`${window.location.origin}/d/${token}`, t('dashboard.linkCopied'))
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

      <AppButton
        to="/transfers/new"
        :label="t('dashboard.newTransfer')"
        :icon="Plus"
      />
    </div>

    <!-- These tabs sit directly on the grey page rather than inside a tile. The
         control's track is a tint, not a colour, so it still has an edge here. -->
    <div class="space-y-6">
      <SegmentedControl
        v-model="tab"
        :items="[
          { label: t('dashboard.sent'), value: 'sent', icon: Send },
          { label: t('dashboard.received'), value: 'received', icon: Inbox }
        ]"
      />

      <!-- Sent -->
      <div v-if="tab === 'sent'">
        <ContentBox
          v-if="!sent.length"
        >
          <p class="py-8 text-center text-muted">
            {{ t('dashboard.empty') }}
          </p>
        </ContentBox>

        <ul
          v-else
          class="space-y-3"
        >
          <li
            v-for="transfer in sent"
            :key="transfer.id"
          >
            <ContentBox
              body-class="p-4 sm:p-5"
            >
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="font-medium text-highlighted truncate">
                      {{ transfer.subject || t('dashboard.files', { count: transfer.fileCount }, transfer.fileCount) }}
                    </h3>

                    <AppBadge
                      v-if="transfer.status === 'draft'"
                      :label="t('dashboard.draft')"
                    />
                    <!-- No recipients means the sender is passing the link on
                           themselves, which is worth showing: nothing was mailed. -->
                    <AppBadge
                      v-else-if="!transfer.recipients"
                      :label="t('dashboard.linkOnly')"
                      :icon="Link"
                    />
                    <AppBadge
                      v-if="transfer.hasPassword"
                      :label="t('dashboard.protected')"
                      :icon="LockIcon"
                    />
                    <AppBadge
                      v-else-if="isExpired(transfer.expiresAt)"
                      :label="t('dashboard.expired')"
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
                  <AppButton
                    v-if="transfer.status === 'sent' && !isExpired(transfer.expiresAt)"
                    :to="downloadUrl(transfer.token)"
                    :icon="ExternalLink"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :aria-label="t('download.downloadFile')"
                  />
                  <AppButton
                    v-if="transfer.status === 'sent' && !isExpired(transfer.expiresAt)"
                    :icon="Copy"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :aria-label="t('dashboard.copyLink')"
                    @click="copyLink(transfer.token)"
                  />
                  <AppButton
                    :icon="Trash2"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :loading="deletingId === transfer.id"
                    :aria-label="t('dashboard.deleteTransfer')"
                    @click="remove(transfer)"
                  />
                </div>
              </div>
            </ContentBox>
          </li>
        </ul>
      </div>

      <!-- Received -->
      <div v-else>
        <ContentBox
          v-if="!received.length"
        >
          <p class="py-8 text-center text-muted">
            {{ t('dashboard.emptyReceived') }}
          </p>
        </ContentBox>

        <ul
          v-else
          class="space-y-3"
        >
          <li
            v-for="transfer in received"
            :key="transfer.id"
          >
            <ContentBox
              body-class="p-4 sm:p-5"
            >
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

                <AppButton
                  v-if="!isExpired(transfer.expiresAt)"
                  :to="downloadUrl(transfer.token)"
                  :label="t('download.downloadFile')"
                  :icon="Download"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  class="shrink-0"
                />
              </div>
            </ContentBox>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
