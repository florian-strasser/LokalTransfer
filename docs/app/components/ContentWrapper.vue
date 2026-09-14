<template>
  <!-- `min-w-0` matters: without it a wide code block or table makes this flex
       child refuse to shrink, and the whole page gains a horizontal scrollbar
       instead of the block getting one. -->
  <div class="min-w-0 grow">
    <slot />
  </div>
</template>
