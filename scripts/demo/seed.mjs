// Fills the demo database with a plausible instance: a team, an outside
// contact, and a spread of transfers covering every way the app can present one
// — a plain list, a password-protected link, an image gallery, a link-only
// share, an incoming guest delivery and a couple of already-expired records.
//
// The schema must exist already; the app's own migrations create it when the
// server starts, which run.sh does before calling this.
//
// SAFETY: this deletes every row in the tables it touches, so it refuses to run
// against a database whose name doesn't look like a throwaway.
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DEMO_PHOTOS, gradientPng } from './images.mjs'

const cfg = {
  host: process.env.DEMO_DB_HOST ?? '127.0.0.1',
  user: process.env.DEMO_DB_USER ?? 'root',
  password: process.env.DEMO_DB_PASS ?? 'root1234',
  database: process.env.DEMO_DB_NAME ?? 'lokaltransfer_demo'
}

const STORAGE = process.env.DEMO_STORAGE ?? '.demo-storage'
const SESSION_TOKEN = process.env.DEMO_TOKEN ?? 'demo-token-florian'
const GUEST_TOKEN = process.env.DEMO_GUEST_TOKEN ?? 'demo-token-guest'

if (!/demo|test/i.test(cfg.database) && process.env.DEMO_DB_FORCE !== '1') {
  console.error(
    `Refusing to seed "${cfg.database}" — the name doesn't look like a throwaway `
    + 'database (expected "demo"/"test"). Set DEMO_DB_FORCE=1 to override.'
  )
  process.exit(1)
}

const db = await mysql.createConnection(cfg)

// Clean slate, children first.
for (const table of [
  'transfer_files', 'transfer_recipients', 'transfers',
  'apikey', 'session', 'verification', 'account', 'user'
]) {
  await db.execute(`DELETE FROM \`${table}\``)
}

const password = await bcrypt.hash('DemoPassword1234', 10)
const hours = n => new Date(Date.now() + n * 60 * 60 * 1000)

async function addUser({ name, email, role = 'user', type = 'member', company = null }) {
  const id = randomUUID()
  await db.execute(
    'INSERT INTO `user` (`id`, `name`, `email`, `role`, `type`, `company`, `emailVerified`) VALUES (?, ?, ?, ?, ?, ?, 1)',
    [id, name, email, role, type, company]
  )
  if (type === 'member') {
    await db.execute(
      'INSERT INTO `account` (`id`, `userId`, `providerId`, `accountId`, `password`) VALUES (?, ?, \'local\', ?, ?)',
      [randomUUID(), id, email, password]
    )
  }
  return { id, name, email }
}

const florian = await addUser({ name: 'Florian Strasser', email: 'florian@example.com', role: 'admin' })
const anna = await addUser({ name: 'Anna Berger', email: 'anna@example.com' })
const jonas = await addUser({ name: 'Jonas Weiß', email: 'jonas@example.com' })
const guest = await addUser({
  name: 'Marie Hoffmann',
  email: 'marie@clientagency.example',
  type: 'guest',
  company: 'Client Agency Ltd'
})

// Sessions the screenshot run authenticates with, by setting the cookie
// directly rather than driving the sign-in form for every capture.
for (const [token, user] of [[SESSION_TOKEN, florian], [GUEST_TOKEN, guest]]) {
  await db.execute(
    'INSERT INTO `session` (`id`, `expiresAt`, `token`, `userId`) VALUES (?, ?, ?, ?)',
    [randomUUID(), hours(24), token, user.id]
  )
}

await db.execute(
  'INSERT INTO `apikey` (`id`, `name`, `start`, `key`, `userId`, `permissions`, `lastUsedAt`) VALUES (?, ?, ?, ?, ?, ?, ?)',
  [randomUUID(), 'Build server', 'a3f1c920', randomBytes(32).toString('hex'), florian.id,
    JSON.stringify(['read', 'write']), hours(-3)]
)
await db.execute(
  'INSERT INTO `apikey` (`id`, `name`, `start`, `key`, `userId`, `permissions`) VALUES (?, ?, ?, ?, ?, ?)',
  [randomUUID(), 'Reporting (read-only)', '77b4e015', randomBytes(32).toString('hex'), florian.id,
    JSON.stringify(['read'])]
)

/**
 * Create one transfer, its recipients and its files — writing real bytes to the
 * demo storage root so the download pages and gallery previews actually work.
 */
async function addTransfer({
  sender, subject, message = null, recipients = [], files,
  layout = 'list', sharePassword = null, expiresInHours = 14 * 24,
  sentHoursAgo = 2, downloads = 0, kind = 'outgoing', status = 'sent'
}) {
  const token = randomBytes(32).toString('hex')
  const [result] = await db.execute(
    `INSERT INTO \`transfers\`
     (\`token\`, \`senderId\`, \`senderName\`, \`senderEmail\`, \`kind\`, \`subject\`, \`message\`,
      \`status\`, \`retentionDays\`, \`expiresAt\`, \`downloadCount\`, \`layout\`, \`passwordHash\`,
      \`createdAt\`, \`sentAt\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 14, ?, ?, ?, ?,
             DATE_SUB(NOW(), INTERVAL ? HOUR), ?)`,
    [
      token, sender.id, sender.name, sender.email, kind, subject, message, status,
      expiresInHours === null ? null : hours(expiresInHours),
      downloads, layout,
      sharePassword ? await bcrypt.hash(sharePassword, 10) : null,
      sentHoursAgo,
      status === 'sent' ? hours(-sentHoursAgo) : null
    ]
  )

  const id = Number(result.insertId)
  const dir = join(STORAGE, 'transfers', String(id))
  await mkdir(dir, { recursive: true })

  for (const file of files) {
    const storedName = randomBytes(24).toString('hex')

    // Images are written for real: the gallery's preview endpoint sniffs magic
    // bytes, so a placeholder would 404 and the thumbnails would be missing.
    //
    // Everything else gets a token file while the *recorded* size is whatever
    // the fixture claims. The interface reads sizes from the database, so the
    // listing looks like a real transfer without this script writing gigabytes
    // to disk for a screenshot — one fixture alone claims 1.2 GB. The only cost
    // is that actually downloading a demo document yields a short file, which no
    // screenshot can tell.
    const bytes = file.png
      ? gradientPng(1200, 800, file.png.from, file.png.to)
      : Buffer.from(`${file.filename}\n\nDemo placeholder.\n`)

    await writeFile(join(dir, storedName), bytes)
    await db.execute(
      'INSERT INTO `transfer_files` (`transfer`, `filename`, `storedName`, `mimeType`, `size`) VALUES (?, ?, ?, ?, ?)',
      [id, file.filename, storedName, file.mimeType ?? 'application/octet-stream', file.png ? bytes.length : file.size]
    )
  }

  for (const recipient of recipients) {
    await db.execute(
      'INSERT INTO `transfer_recipients` (`transfer`, `userId`, `email`, `name`, `notifiedAt`) VALUES (?, ?, ?, ?, NOW())',
      [id, recipient.id ?? null, recipient.email ?? recipient, recipient.name ?? null]
    )
  }

  return { id, token }
}

const MB = 1024 * 1024

// Fixture text is English because the README is: the hero screenshot is taken
// from the English run, and German subjects under an English interface read as
// an accident rather than a demo.
const gallery = await addTransfer({
  sender: florian,
  subject: 'Beach wedding — selects',
  message: 'Here is the selection from the weekend. The RAWs follow separately.',
  recipients: [{ email: 'marie@clientagency.example' }],
  layout: 'gallery',
  downloads: 7,
  // Newest, so it leads the dashboard.
  sentHoursAgo: 1,
  files: DEMO_PHOTOS.map(p => ({
    filename: p.filename,
    mimeType: 'image/png',
    png: { from: p.from, to: p.to }
  }))
})

const documents = await addTransfer({
  sender: florian,
  subject: 'Proposal & draft contract',
  message: 'As discussed — feedback by Friday would be great.',
  recipients: [{ email: 'contact@clientagency.example' }, anna],
  downloads: 3,
  sentHoursAgo: 5,
  files: [
    { filename: 'Proposal-2026-118.pdf', mimeType: 'application/pdf', size: 412 * 1024 },
    { filename: 'Draft-contract.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 88 * 1024 },
    { filename: 'Scope-of-work.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 61 * 1024 }
  ]
})

const locked = await addTransfer({
  sender: florian,
  subject: 'Relaunch credentials',
  message: 'I will pass the password on by phone, as agreed.',
  recipients: [{ email: 'it@clientagency.example' }],
  sharePassword: 'demo',
  expiresInHours: 3 * 24,
  sentHoursAgo: 9,
  files: [{ filename: 'credentials.pdf', mimeType: 'application/pdf', size: 24 * 1024 }]
})

// No recipients: the sender passes the link on themselves.
await addTransfer({
  sender: anna,
  subject: 'Trade-show edit',
  recipients: [],
  downloads: 12,
  sentHoursAgo: 30,
  files: [{ filename: 'tradeshow-cut-v3.mp4', mimeType: 'video/mp4', size: 340 * MB }]
})

// An outside contact delivering files inward — the half an ordinary file host
// does not do.
await addTransfer({
  sender: guest,
  kind: 'guest',
  subject: 'Catalogue print data',
  message: 'Attached are the approved print files. Thanks!',
  recipients: [florian, jonas],
  sentHoursAgo: 8,
  files: [
    { filename: 'catalogue-2026-print.pdf', mimeType: 'application/pdf', size: 96 * MB },
    { filename: 'approval.txt', mimeType: 'text/plain', size: 2 * 1024 }
  ]
})

// A draft, to show the dashboard's "not sent yet" state.
await addTransfer({
  sender: florian,
  status: 'draft',
  subject: 'Rough cut',
  recipients: [{ email: 'jonas@example.com' }],
  // Deliberately not the newest: a draft leading the list would make the first
  // thing in the README screenshot a transfer that was never sent.
  sentHoursAgo: 26,
  files: [{ filename: 'rough-cut.mov', mimeType: 'video/quicktime', size: 1200 * MB }]
})

await db.end()

console.log(JSON.stringify({
  galleryToken: gallery.token,
  documentsToken: documents.token,
  lockedToken: locked.token
}, null, 2))
