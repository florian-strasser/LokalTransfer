<script setup lang="ts">
const { t } = useI18n()
const notify = useNotify()
const { apiErrorMessage } = useApiError()

useSeoMeta({ title: t('users.newUser') })

const type = ref<'member' | 'guest'>('member')
const name = ref('')
const email = ref('')
const company = ref('')
const role = ref<'user' | 'admin'>('user')
const password = ref('')
const sendWelcome = ref(true)

const loading = ref(false)
const errorMessage = ref<string | null>(null)

/**
 * A generated password is offered because this one is transcribed into an e-mail
 * and used once — there is no reason for a human to invent it. Uses the platform
 * CSPRNG, not Math.random.
 */
function generatePassword() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint32Array(16)
  crypto.getRandomValues(bytes)
  password.value = Array.from(bytes, value => alphabet[value % alphabet.length]).join('')
}

// Generated up front so the field is never empty when a member is being created.
generatePassword()

async function submit() {
  loading.value = true
  errorMessage.value = null

  try {
    const response = await $fetch<{ emailSent: boolean }>('/api/admin/users', {
      method: 'POST',
      body: {
        name: name.value,
        email: email.value,
        company: company.value || null,
        type: type.value,
        role: role.value,
        // Guests have no password at all — they authenticate by magic link.
        ...(type.value === 'member' ? { password: password.value } : {}),
        sendWelcome: sendWelcome.value
      }
    })

    notify.success(t('users.created_success'))

    // The account exists regardless; a failed welcome mail is reported so the
    // admin knows to pass the credentials on by hand.
    if (sendWelcome.value && !response.emailSent) {
      notify.error(t('users.welcomeFailed'))
    }

    await navigateTo('/users')
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'users.errors')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <div class="mb-6 flex items-center gap-3">
      <UButton
        to="/users"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        :aria-label="t('common.back')"
      />
      <h1 class="text-2xl font-semibold text-highlighted">
        {{ t('users.newUser') }}
      </h1>
    </div>

    <UCard>
      <form
        class="space-y-5"
        @submit.prevent="submit"
      >
        <UFormField
          :label="t('users.type')"
          :description="type === 'member' ? t('users.membersHint') : t('users.guestsHint')"
        >
          <USelect
            v-model="type"
            :items="[
              { label: t('users.typeMember'), value: 'member' },
              { label: t('users.typeGuest'), value: 'guest' }
            ]"
            value-key="value"
            class="w-full"
          />
        </UFormField>

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

        <!-- Role and password only apply to members. A guest is never an admin
             and never has a password. -->
        <template v-if="type === 'member'">
          <UFormField :label="t('users.role')">
            <USelect
              v-model="role"
              :items="[
                { label: t('users.roleUser'), value: 'user' },
                { label: t('users.roleAdmin'), value: 'admin' }
              ]"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="t('common.password')"
            required
          >
            <UFieldGroup class="w-full">
              <UInput
                v-model="password"
                required
                minlength="8"
                class="w-full font-mono"
              />
              <UButton
                :label="t('users.generatePassword')"
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="subtle"
                @click="generatePassword"
              />
            </UFieldGroup>
          </UFormField>
        </template>

        <UCheckbox
          v-model="sendWelcome"
          :label="t('users.sendWelcome')"
          :description="type === 'member' ? t('users.sendWelcomeMemberHint') : t('users.sendWelcomeGuestHint')"
        />

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
