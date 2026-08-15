// Captures every page against a running, seeded demo server.
//
//   node scripts/demo/screenshots.mjs <output-dir>
//
// Sessions are established by setting the cookie directly rather than driving
// the sign-in form once per capture — the form has its own screenshot, and
// re-authenticating twelve times would only add twelve chances to flake.
//
// The active language is whatever the server was started with (NUXT_LANGUAGE);
// run.sh restarts it once per language.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const outDir = process.argv[2] ?? 'demo-screenshots'
const base = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:3100'
const TOKEN = process.env.DEMO_TOKEN ?? 'demo-token-florian'
const GUEST_TOKEN = process.env.DEMO_GUEST_TOKEN ?? 'demo-token-guest'

// Written by seed.mjs; the download pages are reachable only by their tokens.
const tokens = JSON.parse(readFileSync(process.env.DEMO_TOKENS_FILE ?? '.demo-tokens.json', 'utf8'))

const results = []
const browser = await chromium.launch()

async function shot(ctx, name, url, action) {
  const page = await ctx.newPage()
  try {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto(base + url, { waitUntil: 'load', timeout: 30000 })
    // Fonts, the background image and any client-side fetch all land after
    // `load`; without this the captures catch half-painted pages.
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(600)
    if (action) await action(page)
    await page.screenshot({ path: `${outDir}/${name}.png` })
    results.push('ok    ' + name)
  } catch (error) {
    results.push('FAIL  ' + name + '  :: ' + error.message.split('\n')[0])
  }
  await page.close()
}

const viewport = { width: 1440, height: 900 }
const deviceScaleFactor = 2

const auth = await browser.newContext({ viewport, deviceScaleFactor })
await auth.addCookies([{ name: 'session_token', value: TOKEN, url: base }])

const guest = await browser.newContext({ viewport, deviceScaleFactor })
await guest.addCookies([{ name: 'session_token', value: GUEST_TOKEN, url: base }])

const pub = await browser.newContext({ viewport, deviceScaleFactor })

// --- Public ---------------------------------------------------------------
await shot(pub, '01-sign-in', '/')
await shot(pub, '02-lost-password', '/lost-password')

// What a recipient sees. The gallery is the one that shows this is more than a
// file host, so it leads.
await shot(pub, '03-download-gallery', `/d/${tokens.galleryToken}`)
await shot(pub, '04-download-list', `/d/${tokens.documentsToken}`)
await shot(pub, '05-download-locked', `/d/${tokens.lockedToken}`)

// --- Member ---------------------------------------------------------------
await shot(auth, '10-dashboard', '/dashboard')
await shot(auth, '11-compose', '/transfers/new')

// The composer with files staged: the view that actually shows the product
// being used, and the one the README screenshot comes from. Files are attached
// through the real input rather than mocked, so what is captured is what a
// person would see after dropping them in.
await shot(auth, '12-compose-filled', '/transfers/new', async (page) => {
  const input = page.locator('input[type="file"]').first()
  await input.setInputFiles([
    { name: 'Strandhochzeit-Auswahl.zip', mimeType: 'application/zip', buffer: Buffer.alloc(64, 1) },
    { name: 'Angebot-2026-118.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(64, 2) },
    { name: 'Leistungsverzeichnis.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.alloc(64, 3) }
  ])
  await page.waitForTimeout(700)

  const recipient = page.locator('input[type="email"], input[placeholder*="@"]').first()
  if (await recipient.count()) {
    await recipient.fill('marie@kundenagentur.example')
    await recipient.blur().catch(() => {})
  }

  const subject = page.getByPlaceholder(/worum geht es|what.*about/i).first()
  if (await subject.count()) await subject.fill('Strandhochzeit — Auswahl')

  await page.waitForTimeout(400)
})

await shot(auth, '13-account', '/account')
await shot(auth, '14-users', '/users')
await shot(auth, '15-new-user', '/users/new')

// --- Guest ----------------------------------------------------------------
// An outside contact delivering files inward, with the recipient picker that
// makes it possible without an account.
await shot(guest, '20-guest-upload', '/send')

await browser.close()

console.log(results.join('\n'))
if (results.some(line => line.startsWith('FAIL'))) process.exitCode = 1
