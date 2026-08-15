# LokalTransfer
[![Nuxt](https://img.shields.io/github/package-json/dependency-version/florian-strasser/LokalTransfer/nuxt?label=Nuxt&logo=nuxt&color=00DC82&style=flat)](https://nuxt.com)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white&style=flat)](https://www.mysql.com)
[![Docker](https://img.shields.io/docker/v/florianstrasser/lokaltransfer?label=Docker&logo=docker&color=2496ED&sort=semver&style=flat)](https://hub.docker.com/r/florianstrasser/lokaltransfer)
[![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/florian-strasser/LokalTransfer/blob/master/LICENSE)
[![Version](https://img.shields.io/github/package-json/v/florian-strasser/LokalTransfer?label=version&color=orange)](https://github.com/florian-strasser/LokalTransfer/releases)

![LokalTransfer](https://raw.githubusercontent.com/florian-strasser/LokalTransfer/refs/heads/master/docs/readme-screenshot.webp)

A self-hosted WeTransfer alternative. Send files to clients, and let them send
files back — without either side needing a third-party service.

Built with Nuxt 4, Nuxt UI and MySQL. The authentication, API conventions,
migration runner and mail layer follow the same patterns as
[LokalBoards](https://github.com/florian-strasser/LokalBoards).

## What it does

**Sending.** A team member picks files, types recipient addresses, chooses how
long the files should stay available, and sends. Each recipient gets a mail with
a download button; the sender gets a receipt with the same link.

**Receiving.** External contacts — an agency client, say — are added by an
administrator. They have no password: they enter their address, receive a
one-time sign-in link, and get an upload form where they choose which team
member should receive the files. That turns the usual one-way tool into
something that works in both directions.

**Sharing.** A transfer can go out by e-mail, or the sender can just take the
link and pass it on themselves — by message, chat, or their own mail client.
Either way it can be protected with a password, and presented either as a plain
file list or as a gallery of image thumbnails, which is what makes it usable for
a project shoot or a family event.

**Expiry.** Every transfer has a retention period (14 days by default, up to 90,
or no expiry at all). Once it lapses the download link stops working immediately,
and a scheduled task deletes the files from disk and the rows from the database.

**No public sign-up.** Accounts only exist because an administrator created them.
That is the whole access-control model: anyone who can upload is someone you put
on the list.

## Setup

Requires Node 20+ and a MySQL 8 database.

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill it in — at minimum the database and SMTP
credentials, and `NUXT_APP_URL` (download and sign-in links are built from it, so
in production it must be the address recipients actually reach).

Create the database:

```bash
mysql -u root -p -e "CREATE DATABASE lokaltransfer CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
```

### The first administrator

Because there is no public signup, a fresh instance can't create its first admin
through the UI. There are two ways to seed one; pick whichever fits the
deployment.

**From the environment** (best for containers and managed hosts, where running a
one-off command is awkward). Set these before first start:

```bash
NUXT_ADMIN_NAME=Your Name
NUXT_ADMIN_EMAIL=you@example.com
NUXT_ADMIN_PASSWORD=a-long-password
```

The account is created on startup. This only ever acts when the instance has **no
administrator at all**, so:

- a password you later change in the app is never reverted to the env value;
- the variables are safe to leave configured — they double as a recovery hatch if
  the last admin is ever deleted;
- if the address already belongs to a team member, that account is promoted to
  admin and its password is left alone.

**From the shell** (best for a local or hand-managed install). Start the app once
so the migrations run, then:

```bash
pnpm create-admin "Your Name" you@example.com
```

It asks for the password at a hidden prompt. For an unattended run, set
`ADMIN_PASSWORD` in the environment instead. The password is deliberately not
accepted as a command-line argument and never printed: argv is visible to `ps`
and recorded in shell history, and anything printed lands in whatever is
capturing the output.

Either way, every account after the first is created from **Users** in the app.

## Configuration

Everything is read through Nuxt's `runtimeConfig`, so a single build can be
deployed with different settings — no rebuild needed to change a colour, a limit
or the database. See `.env.example` for the full list; the ones worth knowing:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NUXT_APP_URL` | `http://localhost:3000` | Base for download and magic links |
| `NUXT_LANGUAGE` | `en` | UI and e-mail language (`en` or `de`) |
| `NUXT_TIMEZONE` | `Europe/Berlin` | Zone dates are *displayed* in |
| `NUXT_STORAGE_PATH` | `./storage` | Where uploads live |
| `NUXT_MAX_FILE_SIZE_MB` | `2048` | Per-file limit |
| `NUXT_DEFAULT_RETENTION_DAYS` | `14` | Pre-selected retention; `0` = no expiry |
| `NUXT_SESSION_MAX_AGE_DAYS` | `7` | Member session lifetime |
| `NUXT_GUEST_SESSION_MAX_AGE_HOURS` | `12` | Guest session lifetime |
| `NUXT_ADMIN_EMAIL` / `_PASSWORD` | — | Seeds the first admin; ignored once one exists |

### Colours

A grey page with white tiles on it, plus exactly one accent colour. The accent is
a single environment variable per theme:

```bash
NUXT_PUBLIC_COLOR_PRIMARY="#CC0030"       # light mode
NUXT_PUBLIC_COLOR_PRIMARY_DARK="#DE0F3B"  # dark mode
```

**Quote the hex values.** An unquoted `#` starts a comment in a `.env` file, so
`NUXT_PUBLIC_COLOR_PRIMARY=#CC0030` parses as an empty value and the app falls
back to its built-in default — the result looks fine, which is exactly what makes
it easy to miss. Writing the hex without the `#` works too.

A full 50–950 ramp is derived from each hex at runtime in OKLCH
(`app/utils/colorScale.ts`), so one value themes buttons, links, focus rings,
alerts, the logo, the favicon and the e-mail templates together. Nuxt UI's
semantic colours (success/warning/error/info) are all mapped onto the same accent
in `app/app.config.ts`, which is what keeps a validation error from introducing a
second colour — and, as a consequence, makes success states the accent too.

Text on the accent is forced to white in both themes (also `app.config.ts`), so a
filled button or an active tab never ends up dark-on-colour in dark mode.

The surfaces are fixed rather than derived: `#f5f5f7` page / `#ffffff` tiles in
light, `#1c1c1e` / `#2c2c2e` in dark — the same values LokalBoards uses. Nuxt UI
treats `--ui-bg` as both page and card, so the tile keeps that token and the page
background is set on `body` (see `app/assets/css/main.css`).

`NUXT_PUBLIC_COLOR_NEUTRAL` themes the grey ramp used for borders, muted text and
hover fills. Its chroma is clamped, so a saturated value there is desaturated
rather than becoming a second accent.

### Typography

Inter throughout, self-hosted. `@nuxt/fonts` downloads the weights at build time
and serves them from `/_fonts`, so nothing is requested from Google when someone
loads a page — which matters for a tool run inside an EU company. Each `@font-face`
also tries `local("Inter")` first, so an installed copy is used with no download.

E-mail deliberately does not load a web font: most clients strip `@font-face`, and
a blocked font request is itself a tracking signal. Inter leads the stack there and
falls back to the recipient's system UI font.

### Background

`NUXT_PUBLIC_BACKGROUND_IMAGE` puts an image behind the composer, the download
page and the sign-in screen — a URL, or a path to something in `public/`.
`NUXT_PUBLIC_BACKGROUND_LINK` and `_CREDIT` make it clickable, for crediting a
photographer.

Senders can override it per transfer from the composer's share options. Those
uploads live inside the transfer's own storage directory, so they're deleted with
it. The credit link belongs to the instance default only — a sender's own image
isn't the photographer's, so it carries no attribution.

Panels sit on a translucent, blurred surface with a light wash and an edge
gradient behind them, so text stays legible over a photo of any brightness
without flattening the image into grey.

## Share options

| Option | Notes |
| --- | --- |
| Recipients | Leave empty for a **link-only** transfer: nothing is e-mailed, the sender gets the link and shares it themselves |
| Password | Optional. Recipients enter it once, then the whole transfer stays open in that browser for 12 hours |
| Presentation | **File list** or **gallery** — a grid of image thumbnails, with non-images listed underneath |
| Background | Per-transfer image, overriding the instance default |

Guests get none of these. They're depositing files for someone here, not
publishing a page, so their transfers use the instance defaults.

### How password protection works

The download token already carries 256 bits of entropy, so the password isn't the
only thing protecting the files — it exists so that a *forwarded* link isn't
enough on its own. That's why short passwords are allowed (4 characters), and why
guessing is capped by the download rate limiter rather than by demanding
something long.

A locked transfer returns only its presentation shell — layout and background,
never filenames, sizes or the sender's name, since a file list is often as
revealing as the files. The metadata, file, zip and preview endpoints are all
gated; only the background is public, so the page still looks right behind the
prompt.

Unlocking sets a cookie holding an HMAC of the transfer's identity, keyed by the
transfer's own bcrypt hash. That hash never leaves the server, so the value can't
be forged, and no global signing secret has to be kept stable across deploys.
The cookie is scoped to that one transfer's API path, so unlocking one reveals
nothing about another.

### How gallery previews stay safe

Everything a recipient downloads normally goes out as
`application/octet-stream; attachment`, so an uploaded file can never render as
active content on this origin. The gallery breaks that rule by necessity — it
needs real `<img>` requests — so those endpoints don't trust the uploader at all:

- the file's leading bytes must match a known raster image signature (JPEG, PNG,
  GIF, WebP, AVIF); the declared type and the filename are ignored;
- the `Content-Type` sent is the one derived from those bytes;
- `nosniff` plus a sandbox CSP strip scripting and same-origin privileges anyway.

An HTML file renamed to `.png` fails the signature check, so it never renders — it
appears in the "other files" list and downloads as an attachment like anything
else. SVG is deliberately excluded: it's an image, but it's also a document that
can carry scripts.

## API

Everything the web interface does with transfers can be done over HTTP with an
API key. This is what makes the instance scriptable: a build server that ships
nightly artefacts to a client, a backup job that hands over an export, or an AI
agent that sends files on your behalf.

### Keys

Create one under **Account → API keys**. The plaintext is shown once and never
again — the database stores only a SHA-256 hash, so a leaked database yields no
usable keys.

A key **acts as the person who created it** and carries exactly their
permissions. It is a delegated credential, never an escalation. Two limits are
deliberate:

- **A key can never administer users.** Admin endpoints refuse API keys outright,
  even a key belonging to an administrator, because deleting a user takes every
  transfer they ever sent with them and long-lived credentials end up in CI
  configs. Account administration stays something a person does while signed in.
- **A key can never mint another key.** Otherwise one leaked read-only key could
  bootstrap itself into a permanent write one.

Mark a key **read-only** to let it list and read transfers but not create, send
or delete them. Scope is enforced centrally: over REST it keys off the HTTP
method, over MCP each mutating tool declares itself.

Keys can be given an expiry (up to a year) and revoked at any time, which takes
effect on the next request.

### Sending a transfer over the API

Three steps, mirroring what the browser does. File bytes go over a normal
multipart upload rather than through a JSON body, so a multi-gigabyte file
streams to disk instead of being buffered.

```bash
KEY=your-api-key
BASE=https://transfer.example.com

# 1. Create a draft. Omit "recipients" for a link-only transfer that mails nobody.
ID=$(curl -s -X POST "$BASE/api/transfers" \
  -H "x-api-key: $KEY" -H 'Content-Type: application/json' \
  -d '{"subject":"Nightly build","retentionDays":7,"recipients":["client@example.com"]}' \
  | jq -r .data.id)

# 2. Upload each file, one request each.
curl -s -X POST "$BASE/api/transfers/$ID/files" \
  -H "x-api-key: $KEY" -F "file=@build.zip"

# 3. Send it. This mails the recipients and starts the retention clock.
curl -s -X POST "$BASE/api/transfers/$ID/send" -H "x-api-key: $KEY"
```

The send response carries the `downloadUrl`. Sending is idempotent — a second
call returns `409 TRANSFER_ALREADY_SENT` rather than mailing everyone twice.

### Endpoints

| Method   | Path                        | Purpose                                       |
| -------- | --------------------------- | --------------------------------------------- |
| `GET`    | `/api/transfers`            | Transfers you sent                             |
| `POST`   | `/api/transfers`            | Create a draft                                 |
| `POST`   | `/api/transfers/:id/files`  | Upload one file to a draft                     |
| `POST`   | `/api/transfers/:id/send`   | Deliver it                                     |
| `DELETE` | `/api/transfers/:id`        | Revoke it — files erased, link dead            |
| `GET`    | `/api/recipients`           | Team members you can address                   |
| `GET`    | `/api/auth/api-key`         | Your keys (never the key itself)               |
| `POST`   | `/api/auth/api-key`         | Create a key — **session only**                |
| `DELETE` | `/api/auth/api-key/:id`     | Revoke a key — **session only**                |

Download routes (`/api/download/:token/...`) take no key at all: the token *is*
the credential, because recipients have no account here.

Errors come back as `{ "error": "CODE" }` with a matching HTTP status —
`401 UNAUTHORIZED`, `403 API_KEY_READ_ONLY`, `403 API_KEY_CANNOT_ADMINISTER`,
`404 NOT_FOUND`, `409 TRANSFER_ALREADY_SENT`. Another user's transfer answers
`404`, not `403`, so ids can't be probed for existence.

## MCP server

The instance also speaks [MCP](https://modelcontextprotocol.io), so an AI
assistant can send and manage transfers directly. Point a client at `/mcp` and
authenticate with the same `x-api-key` header:

```json
{
  "mcpServers": {
    "lokaltransfer": {
      "url": "https://transfer.example.com/mcp",
      "headers": { "x-api-key": "your-api-key" }
    }
  }
}
```

Seven tools:

| Tool             | Does                                                          |
| ---------------- | ------------------------------------------------------------- |
| `whoami`         | Which account the key acts as, and whether it is read-only     |
| `listTransfers`  | What you sent, or what was sent to you                         |
| `getTransfer`    | One transfer in full, including its file list                  |
| `listRecipients` | Team members, for resolving a name into an address             |
| `createTransfer` | Start a draft — recipients, retention, password, layout        |
| `sendTransfer`   | Deliver it and return the download link                        |
| `deleteTransfer` | Erase it — files and record, irreversibly                      |

**Uploading is deliberately not a tool.** File bytes have no business inside a
tool call, so `createTransfer` returns the `uploadUrl` to POST them to, and the
server's instructions tell the agent how. Everything else — deciding retention,
resolving a recipient, sending, reporting the link back — is a tool call.

The MCP surface is **member-only** and carries no authority of its own: it is the
same key, the same permissions, the same isolation as the REST API. A read-only
key can call the read tools and nothing else. There is nothing to switch on and
nothing extra to secure; an instance that issues no keys exposes nothing.

## How it works

### Storage

Uploads live under `NUXT_STORAGE_PATH`, one directory per transfer, **outside**
`public/`. Nothing is served statically: every download goes through a handler
that checks the token and the expiry first, and files are always sent as
`application/octet-stream` attachments so an uploaded `.html` can't execute on
this origin.

Original filenames never touch the filesystem — files are stored under random
names and the real name is reattached in the `Content-Disposition` header. That
removes path traversal and filename-collision problems as a class.

### Uploads

Files are uploaded one request each and streamed to disk with busboy, rather than
buffered in memory. A 20 GB transfer costs the same working set as a 20 MB one.
The client (`app/composables/useTransferUpload.ts`) drives this in three phases:
create a draft, upload each file with progress, then send. A draft that is never
sent is swept after `NUXT_DRAFT_MAX_AGE_HOURS`.

### Expiry

Enforced twice, on purpose:

- The download routes refuse an expired transfer the moment it lapses, so the
  promise made to the sender is exact and doesn't depend on task timing.
- The `cleanup` task (every 15 minutes) reclaims the disk and deletes the rows —
  which is what makes "the files are deleted from the server" literally true
  rather than merely "unreachable".

The same task sweeps abandoned drafts, expired sessions and used-up tokens, and
removes storage directories with no matching row.

Shortly before a transfer lapses, its **sender** gets a one-off warning that the
files are about to be deleted, with the download count so far — "not downloaded
yet" the day before deletion is the case worth acting on. The lead time is
`NUXT_EXPIRY_WARNING_HOURS` (24 by default, `0` to switch it off).

It goes to the sender rather than the recipients for two reasons: the sender is
the one who can act on it — download the files again, or re-send — and warning
recipients would turn one expiry into as many extra outbound mails as the
transfer has addresses. A transfer whose whole retention is shorter than the lead
time is skipped, since a warning that arrives with the transfer itself is noise.
`expiryWarningSentAt` on the row is what makes it fire exactly once, rather than
every fifteen minutes for the whole window.

The scheduled task needs a long-lived Node process — the app is meant to run as
`node .output/server/index.mjs` behind a proxy. On a platform that starts a
process per request, expiry would still be enforced at download time, but nothing
would ever reclaim the disk.

### Authentication

Session cookies backed by a `session` table, bcrypt password hashes in a separate
`account` table, and one-time tokens in `verification` distinguished by purpose so
a magic link can never be redeemed as a password reset. Sign-in, password reset
and magic-link endpoints are rate limited per IP, and all of them answer
identically for known and unknown addresses so the app can't be used to test
whether someone has an account.

Guests authenticate only by magic link and are confined to the upload page —
enforced in the route middleware and again in every API handler, since a guest's
session is otherwise an ordinary session.

## Scripts

```bash
pnpm dev         # development server
pnpm build       # production build
pnpm preview     # run the production build locally
pnpm lint        # ESLint
pnpm typecheck   # vue-tsc
pnpm test        # the whole suite
pnpm test:unit   # everything except the end-to-end tests (fast)
pnpm test:watch  # re-run on change
```

## Tests

Vitest, in three layers.

**Unit** (`test/unit/`) — the pure logic, no database: input validation, API-key
hashing and scopes, storage path resolution, and the mail templates in both
languages.

**Integration** (`test/integration/`) — the scheduled sweep against a real
database and a real storage directory. This is the layer that matters most: the
sweep runs unattended on a timer, so nobody is watching when it goes wrong. It
asserts on the disk, not just the rows.

**End to end** (`test/e2e/`) — a real Nuxt server over HTTP, for the paths that
only exist as a running request: the streamed upload, the streamed zip (opened
with `unzip -t` so a corrupt archive fails the test rather than merely looking
plausible), magic-link sign-in and password reset.

Requirements: a MySQL the test user can create a database on, and `unzip` on the
PATH. Then:

```bash
pnpm test
```

The suite uses its own database (`lokaltransfer_test`, created on first run) and
its own storage root (`.test-storage/`), and refuses to start if the database
name doesn't contain "test" — dropping tables is the first thing it does. Mail is
rendered but never sent: the server runs with `NUXT_EMAIL_TRANSPORT=json`, which
is also a useful way to click through the app before SMTP is configured.

Schema comes from the app's own migration runner, so the tests exercise the same
path a fresh deployment takes rather than a hand-maintained copy that could drift
from it. Files run sequentially — they share one database.

### Why `h3` is a direct devDependency

It is there for types only, and pinned to the version **Nitro 2 actually runs**
(v1). Two copies are reachable in the tree — a v2 release candidate arrives
through other packages — and without the pin, Nuxt generated a `tsconfig` mapping
`h3` to v2 while Nitro's own auto-import declarations were written against v1.
Every server file that typed an `event` was then checked against a different h3
than the helpers it called, and `pnpm typecheck` failed on files nobody had
touched. Revisit when the project moves to Nitro 3.

## Docker

```bash
docker run -d --name lokaltransfer -p 3000:3000 \
  -v lokaltransfer-storage:/app/storage \
  -v lokaltransfer-db:/var/lib/mysql \
  --env-file .env \
  florianstrasser/lokaltransfer:latest
```

That is the whole setup. **The image carries its own MySQL 8**, so a bare machine
with Docker on it is enough — there is no database to provision, no second
container to wire up, and no connection string to get right.

Or with compose, which is the same thing with the volumes named for you:

```bash
docker compose up -d
```

### Bring your own database

Set `NUXT_MYSQL_HOST` to anything other than `localhost` and the container skips
its built-in MySQL entirely — it never starts the process, so nothing is wasted
and there is no second place data could accidentally land.

```bash
docker compose -f docker-compose.external-db.yml up -d
```

For anything long-lived this is the better arrangement: a database in its own
container or a managed one can be backed up, restored and upgraded on its own
schedule, and the app can be restarted without touching it. The built-in database
exists so that the first `docker run` works, not because it is the best place to
keep your data.

### What to know either way

- **Two volumes matter.** `/app/storage` holds the uploaded files and
  `/var/lib/mysql` the database. They are only consistent together: files without
  rows are unreachable, rows without files 404. Back them up together.
- **The built-in database generates its own password** on first run and keeps it
  in the data directory. It guards a loopback socket inside the container —
  nothing listens on 3306 outside it — so there is nothing to configure and
  nothing to remember. Set `NUXT_MYSQL_PASSWORD` if you would rather choose.
- **`/api/health`** reports 200 only when the database is reachable, so a
  container that has lost its database is correctly marked unhealthy rather than
  sitting in a load balancer serving errors. The image's `HEALTHCHECK` uses it.
- **A first run takes longer to become healthy** — MySQL initialises its data
  directory before the app can start. The healthcheck allows 90 seconds for it.
- **The image is `linux/amd64` and `linux/arm64`.**

### Publishing

`.github/workflows/docker-publish.yml` builds and pushes both architectures on a
`v*` tag. It needs two repository secrets, `DOCKERHUB_USERNAME` and
`DOCKERHUB_TOKEN` (an access token from Docker Hub → Account Settings → Personal
access tokens, with Read & Write scope). Release with:

```bash
pnpm version patch && git push --follow-tags
```

## Deployment notes

- Put it behind a reverse proxy with TLS. Session cookies are marked `secure`
  when `NODE_ENV=production` or when `X-Forwarded-Proto: https` is present.
- Raise the proxy's request body limit and timeouts to match
  `NUXT_MAX_FILE_SIZE_MB` — nginx's 1 MB `client_max_body_size` default will
  reject uploads long before the app sees them.
- `NUXT_STORAGE_PATH` must be on a volume that survives redeploys, and should be
  included in backups alongside the database. The two are only consistent
  together: files without rows are unreachable, rows without files 404.
- For a managed database that requires TLS (Mittwald, for instance), set
  `NUXT_MYSQL_SSL=true`.
- The rate limiter keeps its state in the Node process, so limits are per
  instance. Running several replicas behind a load balancer would need a shared
  store.
