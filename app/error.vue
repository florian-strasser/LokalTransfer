<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const { t } = useI18n()

const isNotFound = computed(() => props.error?.statusCode === 404)
</script>

<template>
  <UApp>
    <div class="min-h-screen flex items-center justify-center px-6 bg-default">
      <div class="text-center space-y-4">
        <p class="text-sm font-medium text-muted">
          {{ error?.statusCode }}
        </p>

        <h1 class="text-2xl font-semibold text-highlighted">
          {{ isNotFound ? t('error.notFound') : t('error.serverError') }}
        </h1>

        <p
          v-if="isNotFound"
          class="text-muted"
        >
          {{ t('error.notFoundHint') }}
        </p>

        <UButton
          :label="t('error.goHome')"
          @click="clearError({ redirect: '/' })"
        />
      </div>
    </div>
  </UApp>
</template>
