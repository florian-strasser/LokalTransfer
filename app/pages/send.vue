<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'

// The guest upload page: the whole reason an outside contact has an account here.
// They arrive via a magic link, pick which team member should get the files, and
// send. The `blank` layout keeps them out of the member navigation, none of which
// they can open.
definePageMeta({ layout: 'blank' })

const { t } = useI18n()
const { user, signOut } = useAuth()

useSeoMeta({ title: t('compose.guestTitle') })
</script>

<template>
  <div>
    <AppBackground />

    <div class="mx-auto max-w-md py-4">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-highlighted">
            {{ t('compose.guestTitle') }}
          </h1>
          <p class="mt-1 text-sm text-muted">
            {{ t('compose.guestIntro') }}
          </p>
        </div>

        <AppButton
          v-if="user"
          :icon="LogOut"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0"
          :aria-label="t('common.signOut')"
          @click="signOut()"
        />
      </div>

      <TransferComposer mode="guest" />
    </div>
  </div>
</template>
