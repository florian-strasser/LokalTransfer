<script setup lang="ts">
const { locale } = useI18n()

// Set per deployment via NUXT_APP_NAME. Read through useSettings() rather than
// runtimeConfig.public, which cannot see that variable at runtime — see the
// composable for why.
const settings = useSettings()

useHead({
  htmlAttrs: { lang: locale },
  // Pages set their own title chunk, which becomes "<chunk> · <appName>"; a page
  // without one falls back to just the app name. No static title is set here, or
  // it would render as "<appName> · <appName>".
  titleTemplate: titleChunk =>
    (titleChunk ? `${titleChunk} · ${settings.value.appName}` : settings.value.appName)
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
