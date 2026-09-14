<template>
  <!-- The same transfer shown as a gallery rather than a list. The toggle above
       is the sender's choice, and it is per transfer — a shoot wants thumbnails,
       a set of contracts does not. -->
  <div
    class="ui gal"
    aria-hidden="true"
  >
    <div class="ui-panel">
      <div class="gal__toggle">
        <span class="gal__opt">
          <UiIcon name="file" />List
        </span>
        <span class="gal__opt gal__opt--on">
          <UiIcon name="image" />Gallery
        </span>
      </div>

      <div class="gal__grid">
        <span
          v-for="n in 6"
          :key="n"
          class="ui-thumb"
          :class="`gal__thumb--${n}`"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.gal__toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25em;
  padding: 0.2em;
  margin-bottom: 0.7em;
  border-radius: 0.5em;
  background: color-mix(in oklab, var(--color-dark) 7%, transparent);
}
.gal__opt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35em;
  padding: 0.35em;
  border-radius: 0.4em;
}
.gal__opt--on {
  background: var(--color-white);
  color: var(--color-dark);
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
}
.gal__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4em;
}
/* A fixed height instead of the shared 4:3 thumbnail ratio. At 4:3 the rows grew
   with the tile's width and pushed the panel past every other illustration; at a
   height in `em` the panel is the same height at any width and fits the tile. */
.gal__grid .ui-thumb {
  aspect-ratio: auto;
  height: 4.1em;
}
/* Four tints across the six tiles, so the grid reads as photographs rather than
   six identical grey rectangles. */
.gal__thumb--1, .gal__thumb--6 { background: color-mix(in oklab, var(--color-dark) 16%, transparent); }
.gal__thumb--2, .gal__thumb--4 { background: color-mix(in oklab, var(--color-dark) 9%, transparent); }
.gal__thumb--3 { background: color-mix(in oklab, var(--color-primary) 16%, transparent); }
.gal__thumb--5 { background: color-mix(in oklab, var(--color-dark) 22%, transparent); }
</style>
