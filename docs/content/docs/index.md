# Installation

LokalTransfer is a self-hosted file transfer service. You run it on your own
server, and nothing about a transfer — the files, the recipients, the link —
touches anybody else's infrastructure.

There are two ways to install it. Docker is the short one.

## With Docker

The published image carries its own MySQL 8, so there is nothing to set up
first:

```bash
docker run -d \
  --name lokaltransfer \
  -p 3000:3000 \
  -v lokaltransfer-storage:/app/storage \
  -v lokaltransfer-db:/var/lib/mysql \
  -e NUXT_APP_URL=https://transfer.example.com \
  -e NUXT_ADMIN_EMAIL=you@example.com \
  -e NUXT_ADMIN_PASSWORD=a-long-password \
  florianstrasser/lokaltransfer:latest
```

Both volumes matter. Without them the uploads and the database live in the
container's own layer and disappear the first time you recreate it.

If you already run a database, set `NUXT_MYSQL_HOST` and the built-in one never
starts. See [Docker](/docs/docker) for the full picture, including
`docker compose`.

## From source

Requires Node 20+ and a MySQL 8 database.

```bash
git clone https://github.com/florian-strasser/LokalTransfer.git
cd LokalTransfer
pnpm install
cp .env.example .env
```

Fill in `.env` — at minimum the database and SMTP credentials, and
`NUXT_APP_URL`. That last one is not optional in production: download and
sign-in links are built from it, so if it is wrong every link you send is wrong.

Create the database and start the app:

```bash
mysql -u root -p -e "CREATE DATABASE lokaltransfer CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
pnpm build
node .output/server/index.mjs
```

The schema is created on first start. There is no separate migration command to
remember.

## The first administrator

There is no public sign-up, so a fresh instance cannot create its first account
through the interface. Seed one of two ways.

**From the environment** — best for containers and managed hosts:

```bash
NUXT_ADMIN_NAME=Your Name
NUXT_ADMIN_EMAIL=you@example.com
NUXT_ADMIN_PASSWORD=a-long-password
```

The account is created on startup. This only ever acts when the instance has
**no administrator at all**, so a password you later change in the app is never
reverted, and the variables are safe to leave configured — they double as a
recovery hatch if the last admin is ever deleted.

**From the shell** — best for a local or hand-managed install:

```bash
pnpm create-admin "Your Name" you@example.com
```

It asks for the password at a hidden prompt, or takes it from `ADMIN_PASSWORD`
for an unattended run. It is deliberately not accepted as a command-line
argument and never printed: argv is visible to `ps` for every user on the
machine and recorded in shell history, and anything printed lands in whatever is
capturing the output.

Every account after the first is created from **Users** in the app.

## Behind a reverse proxy

Two settings catch people out:

- **Raise the body limit.** nginx defaults `client_max_body_size` to 1&nbsp;MB and
  will reject uploads long before the app sees them. Match it to
  `NUXT_MAX_FILE_SIZE_MB`, and raise the read timeouts while you are there.
- **Forward the protocol.** Session cookies are marked `secure` when
  `NODE_ENV=production` or when `X-Forwarded-Proto: https` is present. Without
  one of those, a browser on HTTPS discards the cookie and sign-in appears to do
  nothing.
