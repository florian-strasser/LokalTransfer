<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { user: currentUser } = useAuth()
const notify = useNotify()
const { apiErrorMessage } = useApiError()

interface ManagedUser {
  id: string
  name: string
  email: string
  role: string
  type: 'member' | 'guest'
  company: string | null
  banned: boolean
}

// There is no single-user endpoint: the list is small, already authorised, and
// this avoids a second route that would need the same access checks.
const { data } = await useFetch<{ data: ManagedUser[] }>('/api/admin/users')
const target = computed(() => data.value?.data.find(item => item.id === route.params.id))

if (!target.value) {
  throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
}

useSeoMeta({ title: target.value.name })

const name = ref(target.value.name)
const email = ref(target.value.email)
const company = ref(target.value.company || '')
const role = ref<'user' | 'admin'>(target.value.role === 'admin' ? 'admin' : 'user')
const password = ref('')

const loading = ref(false)
const errorMessage = ref<string | null>(null)

const isSelf = computed(() => target.value?.id === currentUser.value?.id)

async function submit() {
  loading.value = true
  errorMessage.value = null

  try {
    await $fetch(`/api/admin/users/${route.params.id}`, {
      method: 'PATCH',
      body: {
        name: name.value,
        email: email.value,
        company: company.value || null,
        // Guests have no role to change and no password to set.
        ...(target.value?.type === 'member' ? { role: role.value } : {}),
        // Only sent when actually filled in, so saving other fields doesn't
        // reset the password and sign the person out.
        ...(password.value ? { password: password.value } : {})
      }
    })

    notify.success(t('users.updated'))
    await navigateTo('/users')
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'users.errors')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    v-if="target"
    class="mx-auto max-w-xl"
  >
    <div class="mb-6 flex items-center gap-3">
      <UButton
        to="/users"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        :aria-label="t('common.back')"
      />
      <div>
        <h1 class="text-2xl font-semibold text-highlighted">
          {{ target.name }}
        </h1>
        <p class="text-sm text-muted">
          {{ target.type === 'member' ? t('users.typeMember') : t('users.typeGuest') }}
        </p>
      </div>
    </div>

    <UCard>
      <form
        class="space-y-5"
        @submit.prevent="submit"
      >
        <UFormField
          :label="t('common.name')"
          required
        >
          <UInput
            v-model="name"
            required
            maxlength="255"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="t('common.email')"
          required
        >
          <UInput
            v-model="email"
            type="email"
            required
            maxlength="255"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="`${t('common.company')} (${t('common.optional')})`">
          <UInput
            v-model="company"
            maxlength="255"
            class="w-full"
          />
        </UFormField>

        <template v-if="target.type === 'member'">
          <UFormField :label="t('users.role')">
            <USelect
              v-model="role"
              :items="[
                { label: t('users.roleUser'), value: 'user' },
                { label: t('users.roleAdmin'), value: 'admin' }
              ]"
              value-key="value"
              :disabled="isSelf"
              :help="isSelf ? t('users.errors.CANNOT_DEMOTE_SELF') : undefined"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="t('users.newPassword')"
            :description="t('users.newPasswordHint')"
          >
            <UInput
              v-model="password"
              type="password"
              autocomplete="new-password"
              minlength="8"
              class="w-full"
            />
          </UFormField>
        </template>

        <UAlert
          v-if="errorMessage"
          icon="i-lucide-circle-alert"
          variant="subtle"
          :description="errorMessage"
        />

        <div class="flex gap-2">
          <UButton
            type="submit"
            :label="t('common.save')"
            :loading="loading"
          />
          <UButton
            to="/users"
            :label="t('common.cancel')"
            color="neutral"
            variant="ghost"
          />
        </div>
      </form>
    </UCard>
  </div>
</template>
