<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const { t } = useI18n()
const route = useRoute()
const { fetchSession } = useAuth()

useSeoMeta({ title: t('magic.verifying') })

const failed = ref(false)

// Redeemed on mount rather than during SSR, and by POST rather than by loading
// the page. Mail clients and security scanners routinely prefetch links in
// e-mail with a GET; if opening the URL were enough to consume the token, the
// link would frequently be burnt before the recipient ever clicked it.
onMounted(async () => {
  try {
    await $fetch('/api/auth/magic-link/verify', {
      method: 'POST',
      body: { token: route.params.token }
    })

    const user = await fetchSession(true)
    await navigateTo(user?.type === 'guest' ? '/send' : '/dashboard')
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <div class="py-16">
    <div class="mx-auto max-w-md text-center">
      <div
        v-if="!failed"
        class="flex flex-col items-center gap-4 text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-8 animate-spin"
        />
        <p>{{ t('magic.verifying') }}</p>
      </div>

      <div
        v-else
        class="space-y-6"
      >
        <div class="space-y-2">
          <UIcon
            name="i-lucide-link-2-off"
            class="size-10 text-dimmed"
          />
          <h1 class="text-xl font-semibold text-highlighted">
            {{ t('magic.failed') }}
          </h1>
          <p class="text-muted">
            {{ t('magic.failedHint') }}
          </p>
        </div>

        <UButton
          to="/"
          :label="t('magic.requestNew')"
        />
      </div>
    </div>
  </div>
</template>
