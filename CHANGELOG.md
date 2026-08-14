# Changelog

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
