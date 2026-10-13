<script setup lang="ts">
import { MailCheck } from '@lucide/vue'

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
      <ContentBox>
        <div
          v-if="sent"
          class="space-y-4"
        >
          <AppAlert
            :icon="MailCheck"
            :description="t('lostPassword.sent')"
          />
          <AppButton
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

          <FormField
            :label="t('common.email')"
          >
            <input
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="form-control"
            >
          </FormField>

          <AppButton
            type="submit"
            :label="t('lostPassword.submit')"
            :loading="loading"
            block
            size="lg"
          />

          <div class="text-center">
            <NuxtLink
              to="/"
              class="text-sm text-muted hover:text-default"
            >
              {{ t('lostPassword.backToLogin') }}
            </NuxtLink>
          </div>
        </form>
      </ContentBox>
    </div>
  </div>
</template>
