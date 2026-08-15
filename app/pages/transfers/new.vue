<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('compose.title') })
</script>

<template>
  <div>
    <!-- The instance's own background, with no `src`. A transfer's background
         deliberately does not appear here: it belongs to that transfer's
         download page, and painting it behind the composer turned the sender's
         own form into whatever image they had just picked — unreadable over
         anything busy, and misleading about where the image would end up. -->
    <AppBackground />

    <div class="mx-auto max-w-md py-2">
      <h1 class="mb-4 text-xl font-semibold text-highlighted">
        {{ t('compose.title') }}
      </h1>

      <TransferComposer mode="member" />
    </div>
  </div>
</template>
