<script setup lang="ts">
const config = useRuntimeConfig()
const { locale } = useI18n()

// The app name lives in the server-side runtimeConfig so it can be set per
// deployment via NUXT_APP_NAME. useState carries the resolved value to the
// client, so the title is right during SSR and after client-side navigation.
const appName = useState('appName', () => String(config.public.appName || 'LokalTransfer'))

useHead({
  htmlAttrs: { lang: locale },
  // Pages set their own title chunk, which becomes "<chunk> · <appName>"; a page
  // without one falls back to just the app name. No static title is set here, or
  // it would render as "<appName> · <appName>".
  titleTemplate: titleChunk => (titleChunk ? `${titleChunk} · ${appName.value}` : appName.value)
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
