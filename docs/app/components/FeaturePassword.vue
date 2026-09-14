<template>
  <!-- What a recipient meets when the sender put a password on the link: the
       files are not listed at all until it is right, which is the point — a
       forwarded link on its own gets you this and nothing else. -->
  <div
    class="ui pwd"
    aria-hidden="true"
  >
    <div class="ui-panel pwd__panel">
      <span class="pwd__lock">
        <UiIcon name="lock" />
      </span>

      <p class="pwd__title">
        This transfer is protected
      </p>
      <p class="pwd__hint ui-muted">
        Enter the password to see the files
      </p>

      <div class="ui-field pwd__field">
        <span class="pwd__dots">••••••••••</span>
      </div>
      <div class="ui-btn pwd__btn">
        Unlock
      </div>
    </div>
  </div>
</template>

<style scoped>
.pwd__panel {
  text-align: center;
}
.pwd__lock {
  display: grid;
  place-items: center;
  width: 2.4em;
  height: 2.4em;
  margin: 0 auto 0.6em;
  border-radius: 999px;
  background: color-mix(in oklab, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}
.pwd__title {
  color: var(--color-dark);
  font-weight: 600;
}
.pwd__hint {
  margin-top: 0.15em;
}
.pwd__field {
  margin: 0.7em 0 0.5em;
  justify-content: center;
}
.pwd__dots {
  letter-spacing: 0.18em;
  color: var(--color-dark);
}
</style>
