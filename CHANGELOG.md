# Changelog

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
