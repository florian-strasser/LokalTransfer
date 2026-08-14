<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('compose.title') })

// The composer reports the sender's chosen background so the page behind it can
// show what the recipient will actually see, rather than making them send the
// transfer to find out.
const preview = ref<string | null>(null)
</script>

<template>
  <div>
    <AppBackground :src="preview" />

    <div class="mx-auto max-w-md py-2">
      <h1 class="mb-4 text-xl font-semibold text-highlighted">
        {{ t('compose.title') }}
      </h1>

      <TransferComposer
        mode="member"
        @background-change="preview = $event"
      />
    </div>
  </div>
</template>
