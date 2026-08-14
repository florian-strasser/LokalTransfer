<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const { t } = useI18n()
const { apiErrorMessage } = useApiError()
const route = useRoute()

useSeoMeta({ title: t('resetPassword.title') })

const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const done = ref(false)
const errorMessage = ref<string | null>(null)

async function submit() {
  errorMessage.value = null

  // Checked here as well as on the server so the mismatch is caught before a
  // round trip — the server can't tell the two fields apart anyway.
  if (password.value !== confirmation.value) {
    errorMessage.value = t('resetPassword.mismatch')
    return
  }

  if (password.value.length < 8) {
    errorMessage.value = t('resetPassword.tooShort')
    return
  }

  loading.value = true
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: route.params.token, password: password.value }
    })
    done.value = true
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'resetPassword.errors')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="py-8 sm:py-16">
    <div class="mx-auto max-w-md">
      <!-- No page heading; the field labels carry the meaning. -->
      <UCard>
        <div
          v-if="done"
          class="space-y-4"
        >
          <UAlert
            icon="i-lucide-circle-check"
            variant="subtle"
            :description="t('resetPassword.success')"
          />
          <UButton
            to="/"
            :label="t('login.submit')"
            block
          />
        </div>

        <form
          v-else
          class="space-y-4"
          @submit.prevent="submit"
        >
          <UFormField
            :label="t('resetPassword.newPassword')"
            name="password"
          >
            <UInput
              v-model="password"
              type="password"
              autocomplete="new-password"
              required
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="t('resetPassword.confirmPassword')"
            name="confirmation"
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
            v-if="errorMessage"
            icon="i-lucide-circle-alert"
            variant="subtle"
            :description="errorMessage"
          />

          <UButton
            type="submit"
            :label="t('resetPassword.submit')"
            :loading="loading"
            block
            size="lg"
          />
        </form>
      </UCard>
    </div>
  </div>
</template>
