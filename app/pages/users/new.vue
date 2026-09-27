<script setup lang="ts">
import { ArrowLeft, RefreshCw } from 'lucide-vue-next'

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
      <AppButton
        to="/users"
        :icon="ArrowLeft"
        color="neutral"
        variant="ghost"
        :aria-label="t('common.back')"
      />
      <h1 class="text-2xl font-semibold text-highlighted">
        {{ t('users.newUser') }}
      </h1>
    </div>

    <ContentBox>
      <form
        class="space-y-5"
        @submit.prevent="submit"
      >
        <FormField
          :label="t('users.type')"
          :description="type === 'member' ? t('users.membersHint') : t('users.guestsHint')"
        >
          <select
            v-model="type"
            class="form-control"
          >
            <option value="member">
              {{ t('users.typeMember') }}
            </option>
            <option value="guest">
              {{ t('users.typeGuest') }}
            </option>
          </select>
        </FormField>

        <FormField
          :label="t('common.name')"
          required
        >
          <input
            v-model="name"
            required
            maxlength="255"
            class="form-control"
          >
        </FormField>

        <FormField
          :label="t('common.email')"
          required
        >
          <input
            v-model="email"
            type="email"
            required
            maxlength="255"
            class="form-control"
          >
        </FormField>

        <FormField
          :label="`${t('common.company')} (${t('common.optional')})`"
        >
          <input
            v-model="company"
            maxlength="255"
            class="form-control"
          >
        </FormField>

        <!-- Role and password only apply to members. A guest is never an admin
             and never has a password. -->
        <template v-if="type === 'member'">
          <FormField
            :label="t('users.role')"
          >
            <select
              v-model="role"
              class="form-control"
            >
              <option value="user">
                {{ t('users.roleUser') }}
              </option>
              <option value="admin">
                {{ t('users.roleAdmin') }}
              </option>
            </select>
          </FormField>

          <FormField
            :label="t('common.password')"
            required
          >
            <div class="field-group">
              <input
                v-model="password"
                required
                minlength="8"
                class="form-control font-mono"
              >
              <AppButton
                :label="t('users.generatePassword')"
                :icon="RefreshCw"
                color="neutral"
                variant="subtle"
                size="lg"
                @click="generatePassword"
              />
            </div>
          </FormField>
        </template>

        <InputCheckbox
          v-model="sendWelcome"
          :label="t('users.sendWelcome')"
          :description="type === 'member' ? t('users.sendWelcomeMemberHint') : t('users.sendWelcomeGuestHint')"
        />

        <AppAlert
          v-if="errorMessage"
          :description="errorMessage"
        />

        <div class="flex gap-2">
          <AppButton
            type="submit"
            :label="t('common.save')"
            :loading="loading"
          />
          <AppButton
            to="/users"
            :label="t('common.cancel')"
            color="neutral"
            variant="ghost"
          />
        </div>
      </form>
    </ContentBox>
  </div>
</template>
