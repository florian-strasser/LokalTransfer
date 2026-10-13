<script setup lang="ts">
import { Pencil, Trash2, UserCheck, UserPlus, UserX } from '@lucide/vue'

const { t } = useI18n()
const { user: currentUser } = useAuth()
const { formatDate } = useFormat()
const notify = useNotify()
const { apiErrorMessage } = useApiError()

useSeoMeta({ title: t('users.title') })

interface ManagedUser {
  id: string
  name: string
  email: string
  role: string
  type: 'member' | 'guest'
  company: string | null
  banned: boolean
  createdAt: string
  transferCount: number
}

const { data, refresh } = await useFetch<{ data: ManagedUser[] }>('/api/admin/users')

const users = computed(() => data.value?.data || [])
const members = computed(() => users.value.filter(item => item.type === 'member'))
const guests = computed(() => users.value.filter(item => item.type === 'guest'))

const busyId = ref<string | null>(null)

async function toggleActive(target: ManagedUser) {
  busyId.value = target.id
  try {
    await $fetch(`/api/admin/users/${target.id}`, {
      method: 'PATCH',
      body: { banned: !target.banned }
    })
    notify.success(t('users.updated'))
    await refresh()
  } catch (error) {
    notify.error(apiErrorMessage(error, 'users.errors'))
  } finally {
    busyId.value = null
  }
}

async function remove(target: ManagedUser) {
  if (!window.confirm(t('users.deleteConfirm', { name: target.name }))) return

  busyId.value = target.id
  try {
    await $fetch(`/api/admin/users/${target.id}`, { method: 'DELETE' })
    notify.success(t('users.deleted'))
    await refresh()
  } catch (error) {
    notify.error(apiErrorMessage(error, 'users.errors'))
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="text-2xl font-semibold text-highlighted">
        {{ t('users.title') }}
      </h1>

      <AppButton
        to="/users/new"
        :label="t('users.newUser')"
        :icon="UserPlus"
      />
    </div>

    <div class="space-y-8">
      <section
        v-for="group in [
          { key: 'members', title: t('users.members'), hint: t('users.membersHint'), items: members },
          { key: 'guests', title: t('users.guests'), hint: t('users.guestsHint'), items: guests }
        ]"
        :key="group.key"
      >
        <div class="mb-3">
          <h2 class="font-medium text-highlighted">
            {{ group.title }}
          </h2>
          <p class="text-sm text-muted">
            {{ group.hint }}
          </p>
        </div>

        <ContentBox
          v-if="!group.items.length"
        >
          <p class="py-6 text-center text-sm text-muted">
            —
          </p>
        </ContentBox>

        <ul
          v-else
          class="space-y-2"
        >
          <li
            v-for="item in group.items"
            :key="item.id"
          >
            <ContentBox
              body-class="p-4"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium text-highlighted truncate">{{ item.name }}</span>

                    <AppBadge
                      v-if="item.role === 'admin'"
                      :label="t('users.roleAdmin')"
                      color="primary"
                    />
                    <AppBadge
                      v-if="item.banned"
                      :label="t('users.disabled')"
                    />
                  </div>

                  <p class="truncate text-sm text-muted">
                    {{ item.email }}<template v-if="item.company">
                      · {{ item.company }}
                    </template>
                  </p>

                  <p class="mt-1 text-xs text-dimmed">
                    {{ t('users.created') }} {{ formatDate(item.createdAt) }} ·
                    {{ t('users.transferCount', { count: item.transferCount }, item.transferCount) }}
                  </p>
                </div>

                <div class="flex shrink-0 items-center gap-1">
                  <AppButton
                    :to="`/users/${item.id}`"
                    :icon="Pencil"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :aria-label="t('users.edit')"
                  />
                  <!-- Both actions are hidden for your own row: the server
                       refuses them anyway, so offering them would only produce
                       an error message. -->
                  <AppButton
                    v-if="item.id !== currentUser?.id"
                    :icon="item.banned ? UserCheck : UserX"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :loading="busyId === item.id"
                    :aria-label="item.banned ? t('users.activate') : t('users.deactivate')"
                    @click="toggleActive(item)"
                  />
                  <AppButton
                    v-if="item.id !== currentUser?.id"
                    :icon="Trash2"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :loading="busyId === item.id"
                    :aria-label="t('users.deleteUser')"
                    @click="remove(item)"
                  />
                </div>
              </div>
            </ContentBox>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
