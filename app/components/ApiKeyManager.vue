<script setup lang="ts">
import { Copy, Plus, Trash2 } from '@lucide/vue'

// API key management, on the account page.
//
// The whole design turns on one fact: the server stores only a SHA-256 hash of a
// key, so the plaintext exists exactly once, in the response to the create call.
// The UI therefore has a distinct "here is your key" state that the user has to
// dismiss deliberately, rather than a value that quietly disappears on the next
// render.

const { t } = useI18n()
const { formatDateTime } = useFormat()
const { apiErrorMessage } = useApiError()
const notify = useNotify()
const copy = useCopy()

interface ApiKey {
  id: string
  name: string
  start: string
  readOnly: boolean
  enabled: boolean
  expiresAt: string | null
  expired: boolean
  lastUsedAt: string | null
  createdAt: string
}

const { data, refresh } = await useFetch<{ data: ApiKey[] }>('/api/auth/api-key')
const keys = computed(() => data.value?.data || [])

// --- Creating ----------------------------------------------------------------
const showForm = ref(false)
const name = ref('')
const readOnly = ref(false)
const expiresInDays = ref<number | null>(null)
const creating = ref(false)
const createError = ref<string | null>(null)

/** The one-time plaintext. Held only until the user dismisses it. */
const freshKey = ref<string | null>(null)

const expiryOptions = computed(() => [
  { label: t('apiKeys.expiryNever'), value: null },
  ...[30, 90, 365].map(days => ({
    label: t('apiKeys.expiryDays', { count: days }, days),
    value: days
  }))
])

async function create() {
  creating.value = true
  createError.value = null

  try {
    const response = await $fetch<{ data: { key: string } }>('/api/auth/api-key', {
      method: 'POST',
      body: {
        name: name.value,
        readOnly: readOnly.value,
        expiresInDays: expiresInDays.value
      }
    })

    freshKey.value = response.data.key
    name.value = ''
    readOnly.value = false
    expiresInDays.value = null
    showForm.value = false
    await refresh()
  } catch (error) {
    createError.value = apiErrorMessage(error, 'apiKeys.errors')
  } finally {
    creating.value = false
  }
}

async function copyFresh() {
  if (!freshKey.value) return
  await copy(freshKey.value, t('apiKeys.copied'))
}

// --- Revoking ----------------------------------------------------------------
const revokingId = ref<string | null>(null)

async function revoke(key: ApiKey) {
  if (!window.confirm(t('apiKeys.revokeConfirm', { name: key.name }))) return

  revokingId.value = key.id
  try {
    await $fetch(`/api/auth/api-key/${key.id}`, { method: 'DELETE' })
    notify.success(t('apiKeys.revoked'))
    await refresh()
  } catch (error) {
    notify.error(apiErrorMessage(error, 'apiKeys.errors'))
  } finally {
    revokingId.value = null
  }
}
</script>

<template>
  <ContentBox>
    <template #header>
      <h2 class="font-medium text-highlighted">
        {{ t('apiKeys.title') }}
      </h2>
      <p class="mt-1 text-sm text-muted">
        {{ t('apiKeys.intro') }}
      </p>
    </template>

    <div class="space-y-5">
      <!-- The one-time reveal. Deliberately loud, and dismissed by hand: once
           this is gone the plaintext is unrecoverable. -->
      <div
        v-if="freshKey"
        class="rounded-lg border border-default bg-elevated p-4"
      >
        <p class="font-medium text-highlighted">
          {{ t('apiKeys.created') }}
        </p>
        <p class="mt-1 text-sm text-muted">
          {{ t('apiKeys.createdHint') }}
        </p>

        <div class="field-group mt-3">
          <input
            :value="freshKey"
            readonly
            class="form-control font-mono text-xs"
            @focus="(e: FocusEvent) => (e.target as HTMLInputElement).select()"
          >
          <AppButton
            :icon="Copy"
            color="neutral"
            variant="subtle"
            size="lg"
            :aria-label="t('apiKeys.copy')"
            @click="copyFresh"
          />
        </div>

        <AppButton
          class="mt-3"
          :label="t('apiKeys.done')"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="freshKey = null"
        />
      </div>

      <!-- Existing keys -->
      <p
        v-if="!keys.length"
        class="text-sm text-muted"
      >
        {{ t('apiKeys.none') }}
      </p>

      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="key in keys"
          :key="key.id"
          class="flex items-center gap-3 py-3 first:pt-0"
        >
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-highlighted">{{ key.name }}</span>
              <code class="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-muted">
                {{ key.start }}…
              </code>
              <AppBadge
                v-if="key.readOnly"
                :label="t('apiKeys.readOnlyLabel')"
              />
              <AppBadge
                v-if="key.expired"
                :label="t('apiKeys.expiredLabel')"
              />
            </div>

            <p class="mt-1 text-xs text-dimmed">
              <template v-if="key.lastUsedAt">
                {{ t('apiKeys.lastUsed', { date: formatDateTime(key.lastUsedAt) }) }}
              </template>
              <template v-else>
                {{ t('apiKeys.neverUsed') }}
              </template>
              <template v-if="key.expiresAt">
                · {{ t('apiKeys.expiresOn', { date: formatDateTime(key.expiresAt) }) }}
              </template>
            </p>
          </div>

          <AppButton
            :icon="Trash2"
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="revokingId === key.id"
            :aria-label="t('apiKeys.revoke')"
            @click="revoke(key)"
          />
        </li>
      </ul>

      <!-- Create -->
      <div
        v-if="showForm"
        class="space-y-4 rounded-lg bg-elevated p-4"
      >
        <FormField
          :label="t('apiKeys.name')"
          :description="t('apiKeys.nameHint')"
          required
        >
          <input
            v-model="name"
            :placeholder="t('apiKeys.namePlaceholder')"
            maxlength="255"
            class="form-control"
          >
        </FormField>

        <FormField
          :label="t('apiKeys.expiry')"
        >
          <select
            v-model="expiresInDays"
            class="form-control"
          >
            <option
              v-for="option in expiryOptions"
              :key="String(option.value)"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </FormField>

        <InputCheckbox
          v-model="readOnly"
          :label="t('apiKeys.readOnly')"
          :description="t('apiKeys.readOnlyHint')"
        />

        <AppAlert
          v-if="createError"
          :description="createError"
        />

        <div class="flex gap-2">
          <AppButton
            :label="t('apiKeys.create')"
            :loading="creating"
            :disabled="!name.trim()"
            @click="create"
          />
          <AppButton
            :label="t('common.cancel')"
            color="neutral"
            variant="ghost"
            @click="showForm = false"
          />
        </div>
      </div>

      <AppButton
        v-else
        :label="t('apiKeys.create')"
        :icon="Plus"
        color="neutral"
        variant="subtle"
        @click="showForm = true"
      />
    </div>
  </ContentBox>
</template>
