<template>
  <!-- The whole guest round trip: the mail that arrives, and the form behind the
       link in it. No password at either end, which is the point.

       Stacked rather than overlapped — an earlier version tucked the form under
       the mail to save height and the mail simply covered it. -->
  <div
    class="ui gst"
    aria-hidden="true"
  >
    <div class="ui-panel gst__mail">
      <div class="ui-row">
        <UiIcon name="mail" />
        <span class="gst__subject">Send us your files</span>
      </div>
      <span class="gst__link">
        <UiIcon name="link" />
        Open upload page
      </span>
    </div>

    <div class="ui-panel gst__form">
      <div class="gst__drop">
        <UiIcon name="upload" />
        <span>Drag files here</span>
      </div>
      <div class="ui-row gst__pick">
        <UiIcon name="user" />
        <span>Send to: Florian</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gst {
  display: grid;
  gap: 0.6em;
}
/* Each panel is inset from the opposite side, so the pair reads as two steps of
   one errand rather than as a single stack of unrelated boxes. */
.gst__mail {
  margin-right: 1.4em;
}
.gst__form {
  margin-left: 1.4em;
}
.gst__subject {
  color: var(--color-dark);
  font-weight: 600;
}
.gst__link {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  margin-top: 0.55em;
  color: var(--color-primary);
  font-weight: 600;
}
.gst__drop {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.55em 0.65em;
  border: 1px dashed var(--color-code-border);
  border-radius: 0.5em;
  margin-bottom: 0.55em;
}
.gst__pick {
  color: var(--color-dark);
}
</style>
