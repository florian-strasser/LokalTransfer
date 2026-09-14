<template>
  <main role="main">
    <PageHero />
    <PageAbout />
    <PageFeatures />
    <PagePricing />
    <PageFaq />
    <PageCta />
  </main>
</template>

<script setup lang="ts">
usePageMeta({
  title: 'Self-hosted file transfer with expiring links',
  description:
    'LokalTransfer is an open-source, self-hosted WeTransfer alternative. Send '
    + 'files to clients and let them send files back, with links that expire and '
    + 'files that are really deleted. One Docker image, a REST API and an MCP server.'
})

// The homepage is the site's root, so its title stands alone rather than taking
// the "%s | LokalTransfer" suffix every other page gets.
useHead({ titleTemplate: '%s · LokalTransfer' })
</script>
