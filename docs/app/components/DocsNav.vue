<template>
  <!-- Both collections, always. A page of the API reference is a page of this
       site's documentation too, and having to go back to the header to cross
       between them makes them feel like two separate manuals. -->
  <SideNav
    :sections="sections"
    :is-current="isCurrent"
    label="Documentation"
  />
</template>

<script setup lang="ts">
const { sections, isCurrent, ready } = useDocsNavigation()
await ready
</script>
