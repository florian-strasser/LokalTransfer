# Changelog

## v0.2.0

### Added

- **A documentation and marketing site at lokaltransfer.com**, a statically
  generated Nuxt project under `docs/`: a landing page, a thirteen-part guide
  from installation to troubleshooting, and a REST API reference, plus a sitemap
  and an `llms.txt`. CI builds it alongside the app.

- **Ten languages.** French, Spanish, Italian, Dutch, Polish, Ukrainian,
  Portuguese and Czech join English and German — the same ten as LokalBoards,
  in the same order — for the interface and for every outbound e-mail alike,
  chosen as before with `NUXT_LANGUAGE`.

  Three of them count differently. Polish, Ukrainian and Czech have one, few and
  many, and vue-i18n's built-in three-form rule is zero, one and other, so "5
  plików" would have rendered as "5 pliki". Those three carry three forms in
  every count string and a plural rule of their own, written once in
  `app/utils/locales.ts` and read by the interface, the mail renderer and the
  vue-i18n config, so no two of them can disagree about a plural. The same
  table names the regional tag each language's dates are formatted in, which
  the interface and the mail had each been hard-coding as `de-DE`-or-`en-GB`.

  A unit test holds every locale to the English one key by key — nothing
  missing, nothing extra, no empty string, every placeholder kept, the right
  number of plural forms — and pins the Slavic rules on the counts that tell
  them apart: 22 is "few" in Polish and Ukrainian but "many" in Czech, and 21 is
  singular in Ukrainian alone.

### Security

- **Cleared three Dependabot alerts** — `fast-uri` (high, host confusion via
  percent-encoded scheme normalization), `@tiptap/core` (moderate, `__proto__`
  turned into inherited executable DOM attributes) and `qs` (moderate,
  `arrayLimit` bypass). None is a package this project imports, so all three are
  pinned with overrides rather than by bumping a direct dependency. `pnpm audit`
  reports zero.

  Dependabot could not produce an update for any of them, and the reasons are
  worth recording.

  `fast-uri` and `qs` arrive through `ajv` and `express`, whose ranges (`^3.0.1`,
  `^6.x`) already permit the fixed versions — the lockfile was simply holding an
  older resolution, and `pnpm update` would not move it. Two scoped overrides.

  `@tiptap/*` is the interesting one. It reaches this project as **auto-installed
  peer dependencies** of `@nuxt/ui`, declared as `^3` — so 3.24.0 satisfies the
  range and nothing would ever move it, which is exactly what Dependabot ran
  into. Overriding `@tiptap/core` alone does not work either: the 36 sibling
  packages peer-pin `@tiptap/core` to an *exact* version, so raising core on its
  own leaves every extension demanding the version it just left. All 37 are
  therefore listed, and move together to 3.31.2.

  `@nuxt/ui` went from 4.10.0 to 4.11.0 as a side effect of investigating the
  tiptap resolution. It is within the range already declared and not required by
  any of the three fixes; the interface was checked after the bump.

### Fixed

- **The upload's overall progress is a ring.** While a transfer runs, the figure
  worth looking at is the whole operation, not any one file — so it gets the room:
  an arc on a track with the percentage counting in the middle, and the per-file
  bars still in the list above for the detail. The documentation site's upload
  feature shows the same ring.

  It springs to each reading rather than easing between them. Progress arrives
  per chunk of the stream, several times a second, so a smooth tween between
  chunks was drawing readings the transfer never reported.

  A drop snaps instead of springing. A reading only falls when a new transfer has
  begun, and easing the arc back down reads as progress being lost — the
  documentation site's looping demo showed exactly that at the end of each cycle,
  unwinding from 100 to 0 over a second. Measured across a full loop afterwards:
  one clean drop, then a clean sweep.

  The arc is one circle whose dash pattern is its own circumference, offset by
  however much is left to run, so it is drawn *along* the track rather than being
  a second shape that has to be kept in register with it. The number beside it
  animates per digit, columns keyed from the right so the ones column stays put
  as the figure gains a digit — Motion's own `AnimateNumber` would do this, but
  it is a Motion+ component and ships in no published version of `motion-v`.

  This puts `motion-v` in the application bundle, not just the documentation
  site's. The reduced-motion treatment differs between the two on purpose: the
  site's fragments are decoration and stop, while a progress reading is the
  feedback itself and keeps moving.

- **The upload progress bar could run outside its own track.** `UProgress`
  renders a full-width indicator and slides it into place with
  `translateX(-(100 - percent)%)`, so at 20% the element sits some 400px to the
  left of its track and only `overflow: hidden` keeps it out of sight. Chrome
  clips it; WebKit does not reliably, and the composer gave it two well-known
  reasons not to — a `backdrop-blur` ancestor and a `rounded-full` track. The bar
  then ran out of its wrapper and across the card.

  Both bars — the overall one and the per-file one — now fill by width instead,
  so nothing ever extends past the track and there is nothing left to clip.
  Measured across an upload: the fill's maximum overhang is 0px on every edge,
  against 398px before. Sizes and colours still mirror the Nuxt UI theme, and the
  value is clamped to 0–100, which is the other way a fill could overflow.

- **The compose page and the download page are now the same composition.** The
  card sits against the left edge of the layout — lined up under the logo — and
  the background photograph fills the rest of the viewport, which is what a
  background is for and what the download page already did. The two pages differ
  in what is in the card, not in how the page is built.

  The photograph is no longer washed out on the compose page either. That wash
  existed to keep the page heading legible over an arbitrary image; the heading
  moved inside the card, where it has an opaque surface under it, so there is no
  loose text left to protect and no reason to fade a picture the operator chose.

  The card is centred vertically with auto margins rather than by justifying the
  flex container: the compose form is often taller than the viewport, and
  centring by justification would put the top of it above the scroll origin,
  where it cannot be reached. Checked at 600px tall, where the form overflows —
  it starts below the header and the page scrolls normally.

- **The download card moved back to the left.**

- **The compose page kept its "Neue Übertragung" heading after sending.** The
  form it named had been replaced by the result card, so the page was headed by a
  description of something no longer on screen. The composer now tells the page
  when it has swapped, and the heading goes with the form; the card is centred on
  the viewport rather than left at the top of a mostly empty page.

- **Six environment variables were silently ignored by the interface.**
  `NUXT_APP_NAME`, `NUXT_LANGUAGE`, `NUXT_MAX_FILE_SIZE_MB`,
  `NUXT_MAX_FILES_PER_TRANSFER`, `NUXT_DEFAULT_RETENTION_DAYS` and
  `NUXT_TIMEZONE` all reached the server and none of them reached the browser,
  so the app name in the title and the sidebar, both upload limits, the default
  retention in the composer and the timezone every date is rendered in were
  whatever the image was built with.

  Nuxt maps `runtimeConfig.public.foo` to `NUXT_PUBLIC_FOO` and to nothing else.
  These six sat under `public` fed from plain `NUXT_*` names — and because
  `nuxt.config.ts` is evaluated during the build, that bakes in whatever the
  *build machine* had, after which no variable can dislodge it. The keys looked
  configurable, were documented as configurable, and were not.

  It is invisible in development, where the build and the run share one
  environment, and total on a prebuilt image — which is how this app is meant to
  run. Confirmed against a production build: started with `NUXT_APP_NAME`,
  `NUXT_MAX_FILE_SIZE_MB`, `NUXT_DEFAULT_RETENTION_DAYS` and `NUXT_TIMEZONE` all
  set, the browser still received `LokalTransfer`, `2048` and `14`, while the
  `NUXT_PUBLIC_COLOR_*` variables came through — the segment in the name being
  the only difference between them.

  They are now server-side keys, resolved during SSR and carried to the browser
  in the payload by `useSettings()` — the shape LokalBoards already uses for the
  same two values. No variable is renamed. Mutating `runtimeConfig.public` from a
  Nitro plugin is not an alternative: it is frozen in production and assigning to
  it crashes the server on boot.

  A unit test now fails if any key under `public` is fed by a variable without a
  `PUBLIC_` segment. The mistake is invisible at the call site and costs nothing
  to make again, so it is pinned rather than left to review.

## v0.1.5

### Security

- **`create-admin` no longer handles a secret it can leak.** The previous
  release stopped printing a generated password to non-interactive output, but
  the value still flowed into `console.log` — so CodeQL still flagged it, rightly:
  a runtime `isTTY` branch is not a guarantee about where the string can end up.

  The script no longer generates or prints a password at all. It is typed at a
  hidden prompt, or supplied in `ADMIN_PASSWORD` for an unattended run, and a
  password passed as a command-line argument is now **refused** rather than
  accepted — argv is visible to `ps` for every user on the machine and is
  recorded in shell history, which was the quieter of the two leaks.

  Nothing sensitive reaches stdout, so there is no path left for a CI log, a
  `| tee`, or captured container output to record.

### Notes

- **CodeQL's `js/insufficient-password-hash` on `hashApiKey` needs dismissing in
  the code-scanning UI.** The finding is a false positive — the input is 32 bytes
  from the CSPRNG, so there is nothing to brute-force, and bcrypt would make
  verification a scan over every stored key instead of an indexed lookup. The
  `// codeql[...]` comment added last release did not suppress it: GitHub's
  default setup does not honour inline suppressions, and an inert directive in
  the source reads as a working one. It has been removed and the reasoning left
  as a comment instead.

## v0.1.4

### Security

- **`create-admin` no longer prints a generated password into captured output.**
  It has to reach the operator somehow and the console is the only channel the
  script has, but the same line also wrote the administrator's password into a CI
  log, a `| tee setup.log`, or whatever captures `docker compose up` — files that
  outlive the run and are rarely treated as secrets. It now prints only to an
  interactive terminal, and otherwise says so and points at the third argument.
  Found by CodeQL (`js/clear-text-logging`).

- **Both workflows declare `permissions: contents: read`.** Without an explicit
  block, `GITHUB_TOKEN` inherits the repository default, which on older
  repositories is read-write — far more than linting, testing or pushing to
  Docker Hub with separate credentials needs. Found by CodeQL
  (`actions/missing-workflow-permissions`).

### Notes

- **CodeQL's `js/insufficient-password-hash` on `hashApiKey` is a false
  positive**, and the code is deliberately unchanged. The rule fires on a fast
  hash reaching what it takes to be a password; the input here is 32 bytes from
  the CSPRNG, so there is nothing to brute-force and bcrypt would be actively
  worse — its cost only buys something against guessable secrets, and its
  per-row salt would make verification a scan over every stored key instead of
  an indexed lookup. Suppressed at the call with a comment rather than dismissed
  silently, so the reasoning is where the next reader looks.

## v0.1.3

### Security

- **Cleared all 22 Dependabot alerts** — 2 critical, 12 high, 6 moderate, 2 low —
  in `shell-quote`, `tar`, `js-yaml`, `brace-expansion`, `nanoid`, `svgo`,
  `launch-editor`, `esbuild` and `@babel/core`. Every one arrives through
  something else; none is a package this project imports, so they are pinned with
  overrides rather than by bumping a direct dependency. `pnpm audit` now reports
  zero.

  Most are build- or development-time only, but not all: `brace-expansion`
  reaches production through `archiver`, which is what streams the download zip.

  Ranges are scoped to the affected major line, so a copy already outside the
  advisory — esbuild 0.25.x, brace-expansion 1.x — is not dragged across a major
  boundary for nothing. One forced major bump was unavoidable: the advisory for
  `js-yaml`'s `!!omap` resolution states the fix was not backported to 3.x or
  4.x, so 5.x is the only version that clears it.

  Two things worth knowing for next time. **pnpm 11 ignores `pnpm.overrides` in
  `package.json`** — overrides live in `pnpm-workspace.yaml`, and one written in
  the old place looks applied while doing nothing. And **the local audit database
  lagged GitHub's**: it missed the `nanoid` and `svgo` alerts entirely, so the
  Dependabot list was the authoritative one.

## v0.1.2

### Fixes

- **`NUXT_LANGUAGE` did not change the interface language.** The locale lives in
  runtimeConfig twice — `language` for the server, which renders outbound mail
  with no browser involved, and `public.language` for the interface — and Nuxt
  maps an environment variable to exactly one of them. `NUXT_LANGUAGE` reached
  only the first, so an instance configured for German sent German mail and
  served an English interface, and setting the documented variable could never
  fix it.

  Worst in Docker, which is how this app is meant to run: the image is built once
  with the defaults baked in and configured purely through the environment, so
  there was no build-time escape hatch either.

  The locale is now resolved on the server and carried to the browser in the
  payload, collapsing the two back into one knob. Mutating `public` from a Nitro
  plugin is not the way out — it is frozen in production and assigning to it
  crashes the server on boot, which is what the first attempt did.

### Improvements

- **The download page puts its card against one edge**, instead of centring it —
  which leaves the rest of the viewport to the background image and gives the
  per-transfer background something to do. Opt-in per page
  (`definePageMeta({ align: 'right' })`), so sign-in and password recovery stay
  centred: they have no background to make room for, and a lone form pinned to
  one side just looks unfinished.

  The background is also shown unwashed there. The overlay exists to keep text
  *outside* the panels legible over an arbitrary photograph — but the download
  page is chrome-free and the expiry moved inside the card, so there is no such
  text left, and fading the image only hid what the sender chose it for. Pages
  that do have loose text over the background keep the wash.

  The cards are opaque rather than 90% translucent. The frosted-glass effect let
  the background bleed through, so a white card read as grey on anything but a
  pale image — and legibility over an arbitrary photograph matters more here than
  the effect did.

  The expiry moved inside the card, above the title, on a tinted pill. It used to
  sit underneath on the page itself, where it was unreadable the moment a dark
  background was configured; no fixed text colour survives an arbitrary
  photograph. Leading with it also puts the deadline first, which is the thing a
  recipient has to act on.

- **`pnpm demo:screenshots`.** Builds the app, seeds a throwaway instance and
  captures every page in every language, with a browsable index pairing the
  languages side by side. The README's screenshot is one of those captures and is
  refreshed on every run, so it cannot show an interface that no longer exists.

  The seeded gallery's images are generated as real PNGs rather than shipped as
  assets, because the preview endpoint sniffs magic bytes and would 404 a
  placeholder — the very feature the screenshot exists to show. File sizes are
  fixture values rather than bytes on disk, so a transfer can list a 1.2 GB video
  without the script writing 1.2 GB for a screenshot.

- **Badges and a screenshot at the top of the README**, reading the Nuxt version,
  the app version and the published Docker tag from the repository itself so they
  follow a release instead of being typed by hand.

## v0.1.1

### Fixes

- **Two processes migrating one database at the same time corrupted the run.**
  `runMigrations` read `_migrations`, decided what was outstanding, and applied
  it — with nothing serialising that between processes. Two starting against the
  same fresh database both saw an empty table, both decided the same migration
  was outstanding, and the second one's `ALTER TABLE` failed with a duplicate
  column.

  Found by CI on its very first run, where the database genuinely was new; every
  local run had migrated long ago, so the window never opened here. It was not a
  test-only fault — a rolling deploy or a second replica would hit it just as
  hard, and the published image would have carried it.

  Migration runs are now serialised with a MySQL advisory lock, held on its own
  pooled connection because `GET_LOCK` is per-connection while the migrations run
  through the pool. The applied-list is read *after* the lock is taken; reading
  before would reintroduce the stale view the lock exists to prevent. Verified
  both ways with eight concurrent migrators against a brand-new database: 7 of 8
  fail without the lock, 0 of 8 with it.

- **An interrupted migration could brick an instance permanently.** The runner
  records a migration as applied only after it succeeds, so a process killed
  between an `ALTER TABLE` and that record would re-run the same `ALTER` on the
  next boot and fail on a duplicate column — for ever, since startup could never
  get past it. The two column-adding migrations now check for the column first,
  making a re-run a no-op. The lock does not help here; this is a separate hole.

- **The release workflow tried to sync the README to Docker Hub and couldn't.**
  That endpoint refuses personal access tokens and accepts only the account
  password, so the step failed with `Forbidden` on every release — after the
  image had already been pushed, so nothing was ever actually missing. Removed
  rather than fixed: keeping a cosmetic field in sync is not worth putting a
  credential with full account access into CI. The description is set once by
  hand in the Docker Hub UI.

## v0.1.0

The first release. A self-hosted WeTransfer alternative: send files to clients,
and let them send files back, without either side needing a third-party service.

### Sending and receiving

- **Transfers with streamed uploads.** Files are uploaded one request each and
  piped straight to disk with busboy rather than buffered in memory, so a 20 GB
  transfer costs the same working set as a 20 MB one. A transfer is created as a
  draft, files are added to it with per-file progress, and sending is a separate
  step — which is what makes retrying one failed file possible instead of
  starting over.

- **Guests can send files *to* you.** An administrator adds an outside contact's
  address; that contact has no password, receives a one-time sign-in link, and
  gets an upload form where they pick which team member should receive the files.
  This is the half that ordinary file-transfer services don't do, and it is the
  reason the app exists rather than a link to WeTransfer.

  A guest may only address internal members, resolved from ids against the user
  table. Accepting addresses from the request would have turned the instance into
  an open mail relay for anyone holding a magic link.

- **Link-only transfers.** Leave the recipient list empty and nothing is
  e-mailed: the sender gets the link on screen and passes it on themselves, by
  message or chat or their own mail client.

- **Optional share passwords, and a gallery layout.** A password turns a
  forwarded link into something that still needs a second piece of information.
  The gallery layout renders image thumbnails inline, which is what makes the app
  usable for a shoot or a family event rather than only for documents.

- **Retention, enforced twice.** Every transfer expires — 14 days by default, up
  to 90, or never. The download routes refuse an expired transfer the moment it
  lapses, so the promise made to the sender is exact and doesn't depend on task
  timing; a scheduled sweep then deletes the files from disk and the rows from
  the database, which is what makes "the files are deleted from the server"
  literally true rather than merely "unreachable".

- **A warning before the files go.** Shortly before a transfer lapses its sender
  gets one e-mail — with the download count so far, because "not downloaded yet"
  the day before deletion is the case worth acting on. It goes to the sender
  rather than the recipients: the sender is the one who can act on it, and
  warning recipients would turn one expiry into as many extra outbound mails as
  the transfer has addresses.

- **Responsive HTML mail.** Eight templates in English and German, table-based
  and inline-styled so they survive Outlook, with the accent colour taken from
  the instance's own configuration.

### Access

- **No public sign-up, by design.** Accounts exist because an administrator
  created them. That is the entire access-control model: anyone who can upload is
  someone you put on the list. An env-seeded administrator solves the
  first-run problem that this otherwise creates.

- **Sessions, magic links and password resets.** Session cookies backed by a
  table, bcrypt hashes in a separate `account` table, and one-time tokens
  distinguished by purpose so a magic link can never be redeemed as a password
  reset. Every one of those endpoints is rate limited per IP and answers
  identically for known and unknown addresses, so the app cannot be used to test
  whether someone has an account here.

### Automation

- **A REST API with scoped keys.** Everything the web interface does with
  transfers can be driven over HTTP. Keys are stored as SHA-256 hashes — a leaked
  database yields nothing usable — shown once, revocable, optionally expiring,
  and optionally read-only.

  Two narrowings are deliberate. A key can never administer users, even an
  admin's key, because those endpoints delete accounts and long-lived credentials
  end up in CI configs. And a key can never mint or revoke another key, or one
  leaked key could bootstrap itself into a permanent replacement.

- **An MCP server.** Seven tools let an AI assistant send and manage transfers on
  your behalf, authenticating with the same key as the REST API. Uploading is
  deliberately not a tool — file bytes have no business inside a tool call — so
  `createTransfer` returns the URL to POST them to and the server's instructions
  explain the flow.

### Interface

- **Neutral plus exactly one accent.** The whole interface is white, grey and
  black with a single configurable colour. An eleven-step ramp is generated at
  runtime from one hex, so `NUXT_PUBLIC_COLOR_PRIMARY` themes the app, the mail
  and the favicon without a rebuild.

- **English and German**, chosen at runtime, in the interface and in outbound
  mail alike.

- **Inter, self-hosted.** Downloaded at build time and served from the instance,
  so a page load makes no request to a font CDN.

### Running it

- **A Docker image that brings its own database.** `docker run` on a machine with
  nothing but Docker on it gives a working instance: the image carries MySQL 8,
  so there is no database to provision and no second container to wire up.

  Setting `NUXT_MYSQL_HOST` to anything other than `localhost` makes the
  container skip its built-in MySQL entirely — it never starts the process. That
  is the better arrangement for anything long-lived, and the built-in database
  exists so the first run works rather than because it is the best place to keep
  data.

  Built on the official MySQL image rather than on Node, which is the wrong way
  round for a Node app but the right way round here: the database is the part
  with exacting requirements, while Node is a tarball that drops onto any glibc.
  MySQL specifically and not MariaDB, because the schema uses a MySQL 8
  collation.

- **`/api/health`** reports 200 only when the database answers, so a container
  that has lost its database is marked unhealthy instead of sitting in a load
  balancer serving errors.

### Under the hood

- **Ordered, append-only migrations** run at startup behind a memoized promise
  everything else awaits — Nitro does not guarantee plugin order, and the admin
  bootstrap was observed running before the tables existed.

- **Uploads live outside `public/`** under random stored names, with the original
  filename kept in the database and reattached only in the `Content-Disposition`
  header. That removes path traversal, reserved names and case-insensitive
  overwrites as a class of problem rather than sanitising them one at a time.

- **Inline images are sniffed by magic bytes**, not by filename or declared type,
  and served with `nosniff` and a sandbox CSP. An HTML file renamed to `.png`
  never renders on this origin.

- **151 tests** across three layers: pure logic, the scheduled sweep against a
  real database and real files, and end-to-end over HTTP for the paths that only
  exist as a running request — the streamed upload, the streamed zip, magic-link
  sign-in and password reset. They run against their own database and refuse to
  start if its name doesn't say "test".
