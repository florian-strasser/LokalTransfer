<script setup lang="ts">
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

      <UButton
        to="/users/new"
        :label="t('users.newUser')"
        icon="i-lucide-user-plus"
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

        <UCard v-if="!group.items.length">
          <p class="py-6 text-center text-sm text-muted">
            —
          </p>
        </UCard>

        <ul
          v-else
          class="space-y-2"
        >
          <li
            v-for="item in group.items"
            :key="item.id"
          >
            <UCard :ui="{ body: 'p-4' }">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium text-highlighted truncate">{{ item.name }}</span>

                    <UBadge
                      v-if="item.role === 'admin'"
                      :label="t('users.roleAdmin')"
                      variant="subtle"
                      size="sm"
                    />
                    <UBadge
                      v-if="item.banned"
                      :label="t('users.disabled')"
                      color="neutral"
                      variant="subtle"
                      size="sm"
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
                  <UButton
                    :to="`/users/${item.id}`"
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :aria-label="t('users.edit')"
                  />
                  <!-- Both actions are hidden for your own row: the server
                       refuses them anyway, so offering them would only produce
                       an error message. -->
                  <UButton
                    v-if="item.id !== currentUser?.id"
                    :icon="item.banned ? 'i-lucide-user-check' : 'i-lucide-user-x'"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :loading="busyId === item.id"
                    :aria-label="item.banned ? t('users.activate') : t('users.deactivate')"
                    @click="toggleActive(item)"
                  />
                  <UButton
                    v-if="item.id !== currentUser?.id"
                    icon="i-lucide-trash-2"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :loading="busyId === item.id"
                    :aria-label="t('users.deleteUser')"
                    @click="remove(item)"
                  />
                </div>
              </div>
            </UCard>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
