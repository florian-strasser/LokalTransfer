<template>
  <!-- The composer's delivery switch set to a link, and what the sender gets for
       it: the download link on screen. For this kind of transfer that is the
       only copy there is — nothing was e-mailed. The strings are the app's own.
       A still tile: the point is one state, not a sequence. -->
  <div
    class="ui lnk"
    aria-hidden="true"
  >
    <div class="ui-panel">
      <div class="lnk__switch">
        <span class="lnk__option">
          <UiIcon name="mail" />
          By e-mail
        </span>
        <span class="lnk__option lnk__option--on">
          <UiIcon name="link" />
          Get a link
        </span>
      </div>

      <p class="lnk__label">
        Download link
      </p>
      <div class="lnk__group">
        <div class="ui-field lnk__field">
          <span class="lnk__url">transfer.example.com/d/7fK2qLm9xR4wT8</span>
        </div>
        <span class="lnk__copy">
          <UiIcon name="copy" />
        </span>
      </div>

      <p class="lnk__note ui-muted">
        <UiIcon name="clock" />
        Available until 28 Sep 2026, 11:59
      </p>
    </div>
  </div>
</template>

<style scoped>
.lnk__switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25em;
  padding: 0.25em;
  border-radius: 999px;
  background: color-mix(in oklab, var(--color-dark) 6%, transparent);
}
.lnk__option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35em;
  padding: 0.4em 0.6em;
  border-radius: 999px;
  white-space: nowrap;
}
.lnk__option--on {
  background: var(--color-white);
  color: var(--color-dark);
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
}
.lnk__option--on :deep(svg) {
  color: var(--color-primary);
}
.lnk__label {
  margin: 0.9em 0 0.35em;
  color: var(--color-dark);
  font-weight: 600;
}
/* Field and button side by side at one height: the group stretches both, as
   the app's own field group does. */
.lnk__group {
  display: flex;
  gap: 0.4em;
}
.lnk__field {
  flex: 1;
  min-width: 0;
}
.lnk__url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-dark);
}
.lnk__copy {
  display: grid;
  place-items: center;
  flex: none;
  width: 2.3em;
  border-radius: 0.5em;
  background: color-mix(in oklab, var(--color-dark) 6%, transparent);
  color: var(--color-dark);
}
.lnk__note {
  display: flex;
  align-items: center;
  gap: 0.35em;
  margin-top: 0.55em;
}
</style>
