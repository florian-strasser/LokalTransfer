# Demo screenshots

Generates a fresh, fully-seeded demo instance and captures a screenshot of every
page in each language — for the README, the release notes, or a quick look at
what a change did to the whole interface at once.

## Usage

```bash
pnpm demo:screenshots
# or
bash scripts/demo/run.sh
```

Output lands in `demo-screenshots/<lang>/*.png` with a browsable
`demo-screenshots/index.html` pairing the languages side by side.
(`demo-screenshots/` is gitignored.)

## Requirements

- A local MySQL you can create and drop a throwaway database on
  (defaults to `127.0.0.1`, `root`/`root1234`).
- Playwright's Chromium — `npx playwright install chromium`.
- `cwebp` for the README screenshot, from `brew install webp`. Without it the
  run still completes and simply skips that one step.

The server runs on a spare port (`3100` by default), so it never touches
whatever you have on `:3000`.

## What it does

1. `pnpm run build` (skip with `SKIP_BUILD=1` to reuse `.output`).
2. Drops and recreates the demo database, and clears `.demo-storage`.
3. Starts the built server on `:3100`, which applies the migrations.
4. Seeds a team, an outside contact and a spread of transfers — a gallery, a
   password-protected link, a link-only share, an incoming guest delivery, a
   draft — writing real files to `.demo-storage`.
5. Captures every page, restarting the server once per language.
6. Refreshes `docs/readme-screenshot.webp` from the `04-download-list` capture.
7. Writes the gallery index and drops the database and storage again.

## Notes

**The database and storage are throwaway.** `seed.mjs` deletes every row in the
tables it touches, so it refuses to run against a database whose name doesn't
contain "demo" or "test" unless `DEMO_DB_FORCE=1`. The server is started with
every `NUXT_*` variable set explicitly rather than inheriting the repo's `.env`,
which describes a developer's machine and may point at production.

**The README screenshot is one of the captures**, refreshed on every run, so it
cannot drift from what the app currently looks like. Change which one with
`README_SHOT_VIEW`.

**Images in the seeded gallery are generated as real PNGs** (`images.mjs`)
rather than shipped as assets. The gallery's preview endpoint sniffs magic bytes
and refuses anything that isn't genuinely a raster image, so a placeholder would
404 and the feature the screenshot exists to show would be missing.

**File sizes are fixture values, not bytes on disk.** The interface reads sizes
from the database, so a transfer can list a 1.2 GB video without this script
writing 1.2 GB for a screenshot. Only the seeded images are written in full,
because they have to be.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEMO_DB_HOST` / `USER` / `PASS` / `NAME` | `127.0.0.1`, `root`, `root1234`, `lokaltransfer_demo` | MySQL connection |
| `DEMO_PORT` | `3100` | Server port |
| `DEMO_LANGS` | `en de` | Languages to capture |
| `DEMO_OUT` | `demo-screenshots` | Output directory |
| `DEMO_STORAGE` | `.demo-storage` | Throwaway upload root |
| `README_SHOT` | `docs/readme-screenshot.webp` | README screenshot path |
| `README_SHOT_VIEW` | `04-download-list` | Which capture becomes it |
| `SKIP_BUILD` | — | `1` reuses the existing build |
| `KEEP_DB` | — | `1` keeps the database and storage for inspection |
