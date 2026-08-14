<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const { t } = useI18n()
useSeoMeta({ title: t('lostPassword.title') })

const email = ref('')
const loading = ref(false)
const sent = ref(false)

async function submit() {
  loading.value = true
  try {
    await $fetch('/api/auth/request-password', {
      method: 'POST',
      body: { email: email.value }
    })
  } catch {
    // Deliberately ignored. The endpoint answers identically for a known and an
    // unknown address, and showing an error for one of them here would give away
    // exactly what that design is meant to hide.
  } finally {
    sent.value = true
    loading.value = false
  }
}
</script>

<template>
  <div class="py-8 sm:py-16">
    <div class="mx-auto max-w-md">
      <!-- No page heading: the card's own intro text already says what this
           form does, and pre-auth pages are kept free of chrome. -->
      <UCard>
        <div
          v-if="sent"
          class="space-y-4"
        >
          <UAlert
            icon="i-lucide-mail-check"
            variant="subtle"
            :description="t('lostPassword.sent')"
          />
          <UButton
            to="/"
            :label="t('lostPassword.backToLogin')"
            color="neutral"
            variant="ghost"
            block
          />
        </div>

        <form
          v-else
          class="space-y-4"
          @submit.prevent="submit"
        >
          <p class="text-sm text-muted">
            {{ t('lostPassword.intro') }}
          </p>

          <UFormField
            :label="t('common.email')"
            name="email"
          >
            <UInput
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            :label="t('lostPassword.submit')"
            :loading="loading"
            block
            size="lg"
          />

          <div class="text-center">
            <ULink
              to="/"
              class="text-sm text-muted hover:text-default"
            >
              {{ t('lostPassword.backToLogin') }}
            </ULink>
          </div>
        </form>
      </UCard>
    </div>
  </div>
</template>
