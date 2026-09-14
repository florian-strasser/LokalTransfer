# lokaltransfer.com

The marketing and documentation site, as its own Nuxt project.

```bash
pnpm --filter lokaltransfer-docs dev       # http://localhost:3000
pnpm --filter lokaltransfer-docs generate  # static output in docs/.output/public
```

Or from this directory: `pnpm dev`, `pnpm generate`.

## Why it is separate from the app

The app is a private tool — no public pages, `noindex` everywhere, every route
behind sign-in, and a database and a Node process to run. This site is the
opposite of all of that: public, indexed, and fully static, so it can be served
from any bucket or CDN with nothing behind it.

Merging them would mean one deployment that is both, and the app carrying a
marketing bundle it never serves.

It is still a **pnpm workspace member** rather than a detached install, so one
`pnpm install` at the repository root covers both and the security overrides in
`pnpm-workspace.yaml` apply to its dependencies too. A standalone install would
need its own lockfile, its own audit, and would quietly miss every pin made
there.

The app's Docker build is unaffected: `pnpm install --frozen-lockfile` resolves
without `docs/package.json` present, and none of the site's dependencies land in
the image. `docs` is in `.dockerignore` so a change here does not bust the
build cache either.

## Deploying

```bash
pnpm --filter lokaltransfer-docs generate
```

Upload `docs/.output/public` anywhere that serves static files. There is no
server-side component — the sitemap, `llms.txt` and every page are written at
build time.

## Content

Everything under `content/` is Markdown, and the page title comes from the first
`# heading` rather than frontmatter.

| Directory | Served at | Notes |
| --- | --- | --- |
| `content/docs/` | `/docs/<slug>` | The guide |
| `content/api/` | `/api/<slug>` | The REST reference |
| `content/legal/` | `/site-notice`, `/privacy-policy` | Routes deliberately differ from content paths |

The numeric prefixes on filenames set the order of the sidebar and are stripped
from the URL. Neither menu is alphabetical: both read in the order you would
meet them — install, send something, receive something, then the options.

Adding a page to `content/docs/` or `content/api/` is all that is needed; the
sidebar, the sitemap and `llms.txt` pick it up on the next build.

## Images

`public/images/download-page.webp` is the app's own demo capture, produced by
`pnpm demo:screenshots` in the repository root. Regenerate it there and copy it
across rather than editing it by hand, so the site cannot show an interface that
no longer exists.
