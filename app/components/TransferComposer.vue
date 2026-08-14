<script setup lang="ts">
// The send form, shared by both flows.
//
// A member and a guest are doing the same thing — pick files, pick who gets
// them, send — and the only real difference is how recipients are chosen: a
// member types addresses or shares a link, a guest picks from the team. Keeping
// this in one component means the upload handling, progress display and result
// screen can't drift apart between the two.
//
// Laid out as a single compact panel rather than a page of stacked cards: the
// whole job is meant to read at a glance, with the secondary share options folded
// away until asked for.

const props = defineProps<{
  /** `guest` swaps the free-text recipients for the team picker and hides the
      share options, which guests don't configure. */
  mode: 'member' | 'guest'
}>()

const emit = defineEmits<{
  /**
   * The sender's chosen background, as an object URL (or null when cleared), so
   * the page behind this panel can show what the recipient will actually see.
   *
   * An event rather than `defineExpose`: this component's setup awaits, and Vue
   * ignores an expose registered after an await — the parent's template ref
   * would silently be empty.
   */
  'background-change': [url: string | null]
}>()

const { t } = useI18n()
const { formatBytes, formatDateTime } = useFormat()
const config = useRuntimeConfig().public
const notify = useNotify()

const upload = useTransferUpload()

const subject = ref('')
const message = ref('')

const isMember = computed(() => props.mode === 'member')

// --- Delivery ----------------------------------------------------------------
// Either we mail the recipients, or the sender just takes the link and passes it
// on however they like — by chat, SMS, or their own mail client.
type Delivery = 'email' | 'link'
const delivery = ref<Delivery>('email')

const recipientInput = ref('')
const recipients = ref<string[]>([])
const selectedMembers = ref<string[]>([])

// Only fetched for guests — a member has no use for the list, and it would be an
// unnecessary disclosure of the team roster.
const { data: teamMembers } = await useAsyncData(
  'recipients',
  () => $fetch<{ data: { id: string, name: string, email: string }[] }>('/api/recipients'),
  { immediate: props.mode === 'guest', default: () => ({ data: [] }) }
)

const memberOptions = computed(() =>
  (teamMembers.value?.data || []).map(member => ({
    label: member.name,
    // Shown under the name so a guest can see where the files are actually going.
    description: member.email,
    value: member.id
  })))

function addRecipient() {
  const value = recipientInput.value.trim().toLowerCase()
  if (!value) return

  // Same check as the server's, so an obvious typo is caught before upload
  // rather than after every byte has been transferred.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    notify.error(t('compose.errors.INVALID_RECIPIENT'))
    return
  }

  if (!recipients.value.includes(value)) recipients.value.push(value)
  recipientInput.value = ''
}

function removeRecipient(email: string) {
  recipients.value = recipients.value.filter(entry => entry !== email)
}

// --- Share options -----------------------------------------------------------
const showOptions = ref(false)

const password = ref('')
const layout = ref<'list' | 'gallery'>('list')
const background = ref<File | null>(null)
const backgroundInput = ref<HTMLInputElement | null>(null)

// Object URL so the chosen image can be previewed before it is ever uploaded.
const backgroundPreview = ref<string | null>(null)

function chooseBackground(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (backgroundPreview.value) URL.revokeObjectURL(backgroundPreview.value)
  background.value = file
  backgroundPreview.value = URL.createObjectURL(file)
  emit('background-change', backgroundPreview.value)
}

function clearBackground() {
  if (backgroundPreview.value) URL.revokeObjectURL(backgroundPreview.value)
  background.value = null
  backgroundPreview.value = null
  if (backgroundInput.value) backgroundInput.value.value = ''
  emit('background-change', null)
}

// Object URLs are held by the document until revoked, so release on teardown.
onBeforeUnmount(() => {
  if (backgroundPreview.value) URL.revokeObjectURL(backgroundPreview.value)
})

// Mirrors RETENTION_OPTIONS on the server; 0 is the unlimited option.
const retentionOptions = computed(() =>
  [1, 3, 7, 14, 30, 60, 90, 0].map(days => ({
    label: days === 0 ? t('retention.unlimited') : t('retention.days', { count: days }, days),
    value: days
  })))

const retentionDays = ref(Number(config.defaultRetentionDays) || 14)

const layoutOptions = computed(() => [
  { label: t('compose.layoutList'), value: 'list' as const },
  { label: t('compose.layoutGallery'), value: 'gallery' as const }
])

// A short summary on the options toggle, so what's configured is visible without
// opening it.
const optionsSummary = computed(() => {
  const parts: string[] = []
  if (password.value) parts.push(t('compose.optionPassword'))
  if (layout.value === 'gallery') parts.push(t('compose.layoutGallery'))
  if (background.value) parts.push(t('compose.optionBackground'))
  return parts.join(' · ')
})

// --- Submit ------------------------------------------------------------------
const hasRecipients = computed(() =>
  (props.mode === 'guest' ? selectedMembers.value.length : recipients.value.length) > 0)

const canSubmit = computed(() => {
  if (upload.files.value.length === 0) return false
  if (upload.isBusy.value) return false
  // A link-only transfer needs nobody; every other mode needs at least one.
  if (isMember.value && delivery.value === 'link') return true
  return hasRecipients.value
})

const recipientSummary = computed(() => {
  if (props.mode === 'guest') {
    return memberOptions.value
      .filter(option => selectedMembers.value.includes(option.value))
      .map(option => option.label)
      .join(', ')
  }
  return recipients.value.join(', ')
})

async function submit() {
  // A half-typed address sitting in the input is clearly meant to be included —
  // requiring Enter first would silently drop it.
  if (isMember.value && delivery.value === 'email' && recipientInput.value.trim()) {
    addRecipient()
  }

  await upload.submit({
    subject: subject.value || null,
    message: message.value || null,
    ...(props.mode === 'guest'
      ? { recipientUserIds: selectedMembers.value }
      : {
          // Link-only sends an empty list; the server treats that as deliberate.
          recipients: delivery.value === 'link' ? [] : recipients.value,
          retentionDays: retentionDays.value,
          password: password.value || null,
          layout: layout.value,
          background: background.value
        })
  })
}

function startAnother() {
  upload.reset()
  subject.value = ''
  message.value = ''
  recipients.value = []
  selectedMembers.value = []
  password.value = ''
  layout.value = 'list'
  clearBackground()
  showOptions.value = false
}

async function copyLink() {
  if (!upload.result.value) return
  await navigator.clipboard.writeText(upload.result.value.downloadUrl)
  notify.success(t('dashboard.linkCopied'))
}

const progressLabel = computed(() => {
  if (upload.state.value === 'sending') return t('compose.sending')
  if (upload.state.value === 'uploading') {
    return t('compose.uploading', {
      done: upload.uploadedCount.value + 1,
      total: upload.files.value.length
    })
  }
  return ''
})
</script>

<template>
  <!-- Result ------------------------------------------------------------- -->
  <div
    v-if="upload.state.value === 'done' && upload.result.value"
    class="rounded-2xl border border-default bg-default/90 p-6 shadow-xl backdrop-blur-md sm:p-8"
  >
    <div class="space-y-5 text-center">
      <UIcon
        name="i-lucide-circle-check"
        class="size-12 text-primary"
      />

      <div>
        <h2 class="text-lg font-semibold text-highlighted">
          {{ mode === 'guest' ? t('compose.guestSent') : t('compose.sent') }}
        </h2>
        <p
          v-if="recipientSummary"
          class="mt-1 text-sm text-muted"
        >
          {{ t('compose.sentTo', { recipients: recipientSummary }) }}
        </p>
        <p
          v-else
          class="mt-1 text-sm text-muted"
        >
          {{ t('compose.sentLink') }}
        </p>
      </div>

      <!-- The sender always gets the link on screen. For a link-only transfer
           it's the only copy there is, since nothing was e-mailed. -->
      <div
        v-if="isMember"
        class="text-left"
      >
        <UFormField :label="t('compose.downloadLink')">
          <UFieldGroup class="w-full">
            <UInput
              :model-value="upload.result.value.downloadUrl"
              readonly
              class="w-full"
              @focus="(e: FocusEvent) => (e.target as HTMLInputElement).select()"
            />
            <UButton
              icon="i-lucide-copy"
              color="neutral"
              variant="subtle"
              :aria-label="t('dashboard.copyLink')"
              @click="copyLink"
            />
          </UFieldGroup>
        </UFormField>

        <p
          v-if="upload.result.value.expiresAt"
          class="mt-2 text-sm text-muted"
        >
          {{ t('download.expires', { date: formatDateTime(upload.result.value.expiresAt) }) }}
        </p>
      </div>

      <UButton
        :label="t('compose.newAnother')"
        color="neutral"
        variant="subtle"
        block
        @click="startAnother"
      />
    </div>
  </div>

  <!-- Form --------------------------------------------------------------- -->
  <div
    v-else
    class="rounded-2xl border border-default bg-default/90 shadow-xl backdrop-blur-md"
  >
    <div class="space-y-4 p-5 sm:p-6">
      <!-- Files come first: it's the one thing every transfer needs. -->
      <FileDropzone
        :files="upload.files.value"
        :max-files="upload.maxFiles"
        :max-file-size-mb="Number(config.maxFileSizeMb)"
        :disabled="upload.isBusy.value"
        compact
        @add="upload.addFiles"
        @remove="upload.removeFile"
      />

      <USeparator />

      <!-- Delivery: mail it, or take the link. -->
      <div
        v-if="isMember"
        class="space-y-3"
      >
        <UTabs
          v-model="delivery"
          :items="[
            { label: t('compose.deliveryEmail'), value: 'email', icon: 'i-lucide-mail' },
            { label: t('compose.deliveryLink'), value: 'link', icon: 'i-lucide-link' }
          ]"
          size="sm"
          :content="false"
          :disabled="upload.isBusy.value"
        />

        <UFormField
          v-if="delivery === 'email'"
          :label="t('compose.recipients')"
        >
          <UInput
            v-model="recipientInput"
            type="email"
            :placeholder="t('compose.recipientsPlaceholder')"
            :disabled="upload.isBusy.value"
            class="w-full"
            @keydown.enter.prevent="addRecipient"
            @blur="addRecipient"
          />

          <div
            v-if="recipients.length"
            class="mt-2 flex flex-wrap gap-1.5"
          >
            <UBadge
              v-for="email in recipients"
              :key="email"
              color="neutral"
              variant="subtle"
              class="gap-1"
            >
              {{ email }}
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="link"
                size="xs"
                :padded="false"
                :disabled="upload.isBusy.value"
                :aria-label="t('compose.removeFile')"
                @click="removeRecipient(email)"
              />
            </UBadge>
          </div>
        </UFormField>

        <p
          v-else
          class="rounded-lg bg-elevated px-3 py-2 text-sm text-muted"
        >
          {{ t('compose.deliveryLinkHint') }}
        </p>
      </div>

      <!-- Guests pick from the team instead. -->
      <UFormField
        v-else
        :label="t('compose.recipientPicker')"
        :description="t('compose.recipientPickerHint')"
        required
      >
        <USelectMenu
          v-model="selectedMembers"
          :items="memberOptions"
          value-key="value"
          multiple
          :disabled="upload.isBusy.value"
          :placeholder="t('compose.recipientPicker')"
          class="w-full"
        />
      </UFormField>

      <UInput
        v-model="subject"
        :placeholder="t('compose.subjectPlaceholder')"
        :disabled="upload.isBusy.value"
        maxlength="255"
        class="w-full"
      />

      <UTextarea
        v-model="message"
        :placeholder="t('compose.messagePlaceholder')"
        :disabled="upload.isBusy.value"
        :rows="2"
        autoresize
        maxlength="5000"
        class="w-full"
      />
    </div>

    <!-- Footer: retention, the options drawer, and the send button. -->
    <div class="space-y-3 border-t border-default p-5 sm:p-6">
      <div
        v-if="isMember"
        class="flex items-center gap-2"
      >
        <USelect
          v-model="retentionDays"
          :items="retentionOptions"
          value-key="value"
          icon="i-lucide-calendar-clock"
          :disabled="upload.isBusy.value"
          class="flex-1"
        />
        <UButton
          icon="i-lucide-settings-2"
          color="neutral"
          :variant="showOptions ? 'soft' : 'subtle'"
          :disabled="upload.isBusy.value"
          :aria-label="t('compose.options')"
          :aria-expanded="showOptions"
          @click="showOptions = !showOptions"
        />
      </div>

      <p
        v-if="isMember && optionsSummary && !showOptions"
        class="text-xs text-muted"
      >
        {{ optionsSummary }}
      </p>

      <!-- Share options, folded away until wanted. -->
      <div
        v-if="isMember && showOptions"
        class="space-y-4 rounded-lg bg-elevated p-4"
      >
        <UFormField
          :label="t('compose.password')"
          :description="t('compose.passwordHint')"
        >
          <UInput
            v-model="password"
            type="password"
            autocomplete="new-password"
            :placeholder="t('compose.passwordPlaceholder')"
            :disabled="upload.isBusy.value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="t('compose.layout')"
          :description="t('compose.layoutHint')"
        >
          <USelect
            v-model="layout"
            :items="layoutOptions"
            value-key="value"
            :disabled="upload.isBusy.value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="t('compose.background')"
          :description="t('compose.backgroundHint')"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="backgroundPreview"
              :src="backgroundPreview"
              alt=""
              class="size-12 shrink-0 rounded-md object-cover"
            >
            <UButton
              :label="background ? t('compose.backgroundChange') : t('compose.backgroundChoose')"
              icon="i-lucide-image"
              color="neutral"
              variant="subtle"
              size="sm"
              :disabled="upload.isBusy.value"
              @click="backgroundInput?.click()"
            />
            <UButton
              v-if="background"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="t('compose.backgroundRemove')"
              @click="clearBackground"
            />
          </div>
          <input
            ref="backgroundInput"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
            class="hidden"
            @change="chooseBackground"
          >
        </UFormField>
      </div>

      <UAlert
        v-if="upload.errorMessage.value"
        icon="i-lucide-circle-alert"
        variant="subtle"
        :description="upload.errorMessage.value"
      />

      <div
        v-if="upload.isBusy.value"
        class="space-y-2"
      >
        <div class="flex items-center justify-between text-sm text-muted">
          <span>{{ progressLabel }}</span>
          <span>{{ upload.overallProgress.value }}%</span>
        </div>
        <UProgress :model-value="upload.overallProgress.value" />
      </div>

      <UButton
        :label="t('compose.send')"
        :loading="upload.isBusy.value"
        :disabled="!canSubmit"
        size="lg"
        block
        @click="submit"
      />

      <p
        v-if="upload.files.value.length"
        class="text-center text-xs text-muted"
      >
        {{ t('compose.totalSize', {
          count: upload.files.value.length,
          size: formatBytes(upload.totalSize.value)
        }, upload.files.value.length) }}
      </p>
    </div>
  </div>
</template>
