<template>
  <main
    role="main"
    class="container pt-30 pb-10 sm:pb-14"
  >
    <div class="flex flex-col gap-10 md:flex-row md:items-start md:gap-12">
      <DocsNav />
      <ContentWrapper>
        <ContentRenderer
          v-if="page"
          :value="page"
          class="wysiwyg"
        />
      </ContentWrapper>
    </div>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()
const slug = String(route.params.slug)

const { data: page } = await useAsyncData(`docs-${slug}`, () =>
  queryCollection('docs').path(`/docs/${slug}`).first())

// A slug with no page behind it used to render the chrome around an empty
// article and answer 200, so a mistyped URL looked like a real but empty page —
// to a reader and to a crawler alike.
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

usePageMeta({
  title: page.value?.title,
  description: page.value?.description
})
</script>
