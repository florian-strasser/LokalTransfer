<template>
  <main
    role="main"
    class="container pt-30 pb-14 sm:pt-36 sm:pb-20"
  >
    <ContentRenderer
      v-if="page"
      :value="page"
      class="wysiwyg max-w-3xl"
    />
  </main>
</template>

<script setup lang="ts">
// Both legal pages are the same shape: one Markdown file rendered on its own.
// The path is passed in rather than derived from the route, because the routes
// (/site-notice) and the content paths (/legal/site-notice) deliberately differ.
const props = defineProps<{ path: string }>()

const { data: page } = await useAsyncData(`legal-${props.path}`, () =>
  queryCollection('content').path(`/legal/${props.path}`).first())

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

usePageMeta({
  title: page.value?.title,
  description: page.value?.description
})
</script>
