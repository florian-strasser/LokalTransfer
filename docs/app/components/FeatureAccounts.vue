<template>
  <!-- The whole access-control model on one screen: a list an administrator
       wrote. There is no sign-up form to show, which is the tile's point. -->
  <div
    class="ui acc"
    aria-hidden="true"
  >
    <div class="ui-panel">
      <p class="ui-head">
        <span>Users</span>
        <span class="ui-chip acc__add">+ Invite</span>
      </p>

      <div
        v-for="person in people"
        :key="person.name"
        class="ui-row acc__row"
      >
        <span class="ui-avatar">{{ person.initials }}</span>
        <span class="ui-file__name">{{ person.name }}</span>
        <span class="ui-file__size ui-muted">{{ person.role }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Two members and an outside contact — the three kinds of account the app has.
const people = [
  { initials: 'FS', name: 'Florian Strasser', role: 'Admin' },
  { initials: 'MK', name: 'Marie Kessler', role: 'Member' },
  { initials: 'AC', name: 'Acme GmbH', role: 'Contact' }
]
</script>

<style scoped>
.acc__row + .acc__row {
  margin-top: 0.55em;
}
.acc__add {
  font-size: 0.9em;
}
</style>
