<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const { t } = useI18n()
const route = useRoute()
const { fetchSession } = useAuth()
const { apiErrorMessage } = useApiError()

useSeoMeta({ title: t('login.title') })

// Two ways in, side by side: staff sign in with a password, outside contacts ask
// for a one-time link. There is no third tab for signing up — accounts only
// exist because an administrator created them, which is what stops strangers
// putting files on the server.
const tab = ref<'member' | 'guest'>('member')

const email = ref('')
const password = ref('')
const guestEmail = ref('')

const loading = ref(false)
const errorMessage = ref<string | null>(null)
const linkSent = ref(false)

async function signIn() {
  loading.value = true
  errorMessage.value = null

  try {
    await $fetch('/api/auth/sign-in', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })

    // Force a refetch: the cached session state is "signed out" at this point.
    const user = await fetchSession(true)

    // Honour the destination the guard captured, but only if it's a path on this
    // site — an absolute URL here would be an open redirect.
    const redirect = String(route.query.redirect || '')
    const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : null

    await navigateTo(safeRedirect || (user?.type === 'guest' ? '/send' : '/dashboard'))
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'login.errors')
  } finally {
    loading.value = false
  }
}

async function requestMagicLink() {
  loading.value = true
  errorMessage.value = null

  try {
    await $fetch('/api/auth/magic-link/request', {
      method: 'POST',
      body: { email: guestEmail.value }
    })
    // Shown whether or not the address is on file — the endpoint deliberately
    // gives the same answer either way, and the UI must not undo that.
    linkSent.value = true
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'login.errors')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <AppBackground />

    <!-- Nothing above the card: the sign-in form is the entire page, centred by
         the blank layout. The logo and tagline that used to sit here pushed it
         off-centre and told anyone who found the URL what software the server
         runs — which is the same reason there is no header. -->
    <div class="mx-auto max-w-md">
      <UCard :ui="{ root: 'bg-default/90 backdrop-blur-md' }">
        <UTabs
          v-model="tab"
          :items="[
            { label: t('login.tabMember'), value: 'member', icon: 'i-lucide-user' },
            { label: t('login.tabGuest'), value: 'guest', icon: 'i-lucide-mail' }
          ]"
          :ui="{ root: 'gap-6' }"
        >
          <template #content="{ item }">
            <form
              v-if="item.value === 'member'"
              class="space-y-4"
              @submit.prevent="signIn"
            >
              <UFormField
                :label="t('common.email')"
                name="email"
              >
                <UInput
                  v-model="email"
                  type="email"
                  autocomplete="username"
                  required
                  class="w-full"
                />
              </UFormField>

              <UFormField
                :label="t('common.password')"
                name="password"
              >
                <UInput
                  v-model="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  class="w-full"
                />
              </UFormField>

              <UAlert
                v-if="errorMessage"
                icon="i-lucide-circle-alert"
                variant="subtle"
                :description="errorMessage"
              />

              <UButton
                type="submit"
                :label="t('login.submit')"
                :loading="loading"
                block
                size="lg"
              />

              <div class="text-center">
                <ULink
                  to="/lost-password"
                  class="text-sm text-muted hover:text-default"
                >
                  {{ t('login.forgotPassword') }}
                </ULink>
              </div>
            </form>

            <div v-else>
              <div
                v-if="linkSent"
                class="space-y-4"
              >
                <UAlert
                  icon="i-lucide-mail-check"
                  variant="subtle"
                  :description="t('login.linkSent')"
                />
                <UButton
                  :label="t('common.back')"
                  color="neutral"
                  variant="ghost"
                  block
                  @click="linkSent = false"
                />
              </div>

              <form
                v-else
                class="space-y-4"
                @submit.prevent="requestMagicLink"
              >
                <p class="text-sm text-muted">
                  {{ t('login.guestIntro') }}
                </p>

                <UFormField
                  :label="t('common.email')"
                  name="guestEmail"
                >
                  <UInput
                    v-model="guestEmail"
                    type="email"
                    autocomplete="email"
                    required
                    class="w-full"
                  />
                </UFormField>

                <UAlert
                  v-if="errorMessage"
                  icon="i-lucide-circle-alert"
                  variant="subtle"
                  :description="errorMessage"
                />

                <UButton
                  type="submit"
                  :label="t('login.requestLink')"
                  :loading="loading"
                  block
                  size="lg"
                />
              </form>
            </div>
          </template>
        </UTabs>
      </UCard>

      <p class="mt-6 text-center text-xs text-dimmed">
        {{ t('login.noSignup') }}
      </p>
    </div>
  </div>
</template>
