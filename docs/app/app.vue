<template>
  <div class="min-h-screen flex flex-col">
    <NuxtRouteAnnouncer />
    <AppHeader />
    <!-- The header stays outside: it is sticky to the window, which is what
         Lenis scrolls, so it needs nothing from the wrapper. -->
    <SmoothScroll>
      <NuxtPage class="grow" />
      <AppFooter />
    </SmoothScroll>

    <!-- Last, and above everything: it covers the screen while one page is
         swapped for the next. -->
    <PageCurtain />
  </div>
</template>
