<script setup lang="ts">
const { t } = useI18n()
const { user, fetchSession, isMember } = useAuth()
const notify = useNotify()
const { apiErrorMessage } = useApiError()

useSeoMeta({ title: t('account.title') })

const name = ref(user.value?.name || '')
const company = ref(user.value?.company || '')
const profileLoading = ref(false)

async function saveProfile() {
  profileLoading.value = true
  try {
    await $fetch('/api/auth/update-user', {
      method: 'POST',
      body: { name: name.value, company: company.value || null }
    })
    // Refetched so the name in the header updates without a reload.
    await fetchSession(true)
    notify.success(t('account.saved'))
  } catch {
    notify.error(t('common.unknownError'))
  } finally {
    profileLoading.value = false
  }
}

// --- Default background ------------------------------------------------------
// Saved the moment an image is picked — there is nothing else on this card to
// submit — and read back through the session, whose URL is versioned by the
// stored file, so the new picture shows without a stale cached one in between.
const backgroundFile = ref<File | null>(null)
const backgroundBusy = ref(false)

watch(backgroundFile, async (file) => {
  if (!file) return
  backgroundBusy.value = true
  try {
    const form = new FormData()
    form.append('background', file)
    await $fetch('/api/account/background', { method: 'POST', body: form })
    await fetchSession(true)
    notify.success(t('account.backgroundSaved'))
  } catch (error) {
    notify.error(apiErrorMessage(error, 'compose.errors'))
  } finally {
    backgroundFile.value = null
    backgroundBusy.value = false
  }
})

async function removeBackground() {
  backgroundBusy.value = true
  try {
    await $fetch('/api/account/background', { method: 'DELETE' })
    await fetchSession(true)
    notify.success(t('account.backgroundRemoved'))
  } catch {
    notify.error(t('common.unknownError'))
  } finally {
    backgroundBusy.value = false
  }
}

const currentPassword = ref('')
const newPassword = ref('')
const confirmation = ref('')
const passwordLoading = ref(false)
const passwordError = ref<string | null>(null)

async function savePassword() {
  passwordError.value = null

  if (newPassword.value !== confirmation.value) {
    passwordError.value = t('resetPassword.mismatch')
    return
  }
  if (newPassword.value.length < 8) {
    passwordError.value = t('resetPassword.tooShort')
    return
  }

  passwordLoading.value = true
  try {
    await $fetch('/api/auth/update-password', {
      method: 'POST',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value }
    })

    currentPassword.value = ''
    newPassword.value = ''
    confirmation.value = ''
    notify.success(t('account.passwordChanged'))
  } catch (error) {
    passwordError.value = apiErrorMessage(error, 'account.errors')
  } finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <h1 class="mb-6 text-2xl font-semibold text-highlighted">
      {{ t('account.title') }}
    </h1>

    <div class="space-y-6">
      <UCard>
        <template #header>
          <h2 class="font-medium text-highlighted">
            {{ t('account.profile') }}
          </h2>
        </template>

        <form
          class="space-y-4"
          @submit.prevent="saveProfile"
        >
          <UFormField
            :label="t('common.name')"
            required
          >
            <UInput
              v-model="name"
              required
              maxlength="255"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="`${t('common.company')} (${t('common.optional')})`">
            <UInput
              v-model="company"
              maxlength="255"
              class="w-full"
            />
          </UFormField>

          <!-- Read-only: the address is the identity transfers are delivered to
               and magic links are issued against, so changing it is an admin
               action rather than something a session can do to itself. -->
          <UFormField :label="t('common.email')">
            <UInput
              :model-value="user?.email"
              disabled
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            :label="t('common.save')"
            :loading="profileLoading"
          />
        </form>
      </UCard>

      <!-- Members only: a guest drops files off and has no download page of
           their own to dress. -->
      <UCard v-if="isMember">
        <template #header>
          <h2 class="font-medium text-highlighted">
            {{ t('account.background') }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ t('account.backgroundHint') }}
          </p>
        </template>

        <ImageDropzone
          v-model="backgroundFile"
          :src="user?.background"
          :label="t('compose.backgroundChoose')"
          :hint="t('compose.backgroundDropHint')"
          :remove-label="t('compose.backgroundRemove')"
          :disabled="backgroundBusy"
          @remove="removeBackground"
        />
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-medium text-highlighted">
            {{ t('account.changePassword') }}
          </h2>
        </template>

        <form
          class="space-y-4"
          @submit.prevent="savePassword"
        >
          <UFormField
            :label="t('account.currentPassword')"
            required
          >
            <UInput
              v-model="currentPassword"
              type="password"
              autocomplete="current-password"
              required
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="t('account.newPassword')"
            required
          >
            <UInput
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              required
              minlength="8"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="t('account.confirmPassword')"
            required
          >
            <UInput
              v-model="confirmation"
              type="password"
              autocomplete="new-password"
              required
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="passwordError"
            icon="i-lucide-circle-alert"
            variant="subtle"
            :description="passwordError"
          />

          <UButton
            type="submit"
            :label="t('common.save')"
            :loading="passwordLoading"
          />
        </form>
      </UCard>

      <!-- API keys live on the account page rather than a separate screen: they
           are a property of the signed-in person, not an admin setting. -->
      <ApiKeyManager />
    </div>
  </div>
</template>
