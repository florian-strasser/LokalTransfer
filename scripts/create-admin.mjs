#!/usr/bin/env node
// Create the first administrator.
//
// There is no public sign-up and no self-service bootstrap route, because either
// one would be a window during which a stranger could claim the instance. So the
// first account is created here, from the server's own shell, by someone who
// already has access to it. Every account after that is created from the admin UI.
//
//   node scripts/create-admin.mjs "Your Name" you@example.com
//
// Reads the same NUXT_MYSQL_* variables as the app. The password is typed at a
// hidden prompt, or supplied in ADMIN_PASSWORD for an unattended run.
//
// It is never printed, and never taken from the command line. A secret in argv
// is visible to `ps` for every user on the box and lands in shell history; a
// secret printed to stdout lands in whatever is capturing it — a CI log, a
// `| tee`, the container's output. Reading it from a prompt or the environment
// is the only path that leaves it in neither.

import { createPool } from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import { readFileSync } from 'node:fs'

// Nuxt loads .env itself; this script runs outside Nuxt, so it reads the file
// directly. Deliberately minimal: enough for KEY=value and quoted values.
function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (!match) continue
      const key = match[1]
      if (process.env[key] !== undefined) continue
      let value = (match[2] || '').trim()
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith('\'') && value.endsWith('\''))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  } catch {
    // No .env file — rely on the real environment.
  }
}

loadEnvFile('.env')

const [name, email, extra] = process.argv.slice(2)

if (!name || !email) {
  console.error('Usage: node scripts/create-admin.mjs "Full Name" email@example.com')
  console.error('The password is typed at a prompt, or set in ADMIN_PASSWORD.')
  process.exit(1)
}

// Refused rather than accepted quietly: someone passing a password here has put
// it in their shell history and in `ps` output, and should know that.
if (extra) {
  console.error('Do not pass the password as an argument — it is visible in `ps`')
  console.error('and recorded in your shell history. Set ADMIN_PASSWORD instead,')
  console.error('or omit it and type it at the prompt.')
  process.exit(1)
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`Not a valid e-mail address: ${email}`)
  process.exit(1)
}

/**
 * Read a line from the terminal without echoing it.
 *
 * `_writeToOutput` is readline's own hook for exactly this; overriding it lets
 * the prompt through and swallows the keystrokes, so the password never reaches
 * the screen and so cannot be read over a shoulder or scraped from a scrollback
 * buffer.
 */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('No terminal to prompt on. Set ADMIN_PASSWORD instead.'))
      return
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (chunk) => {
      if (chunk.includes(question)) process.stdout.write(question)
    }

    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

let password = process.env.ADMIN_PASSWORD
if (!password) {
  // A stack trace here would be noise: not having a terminal is a normal way to
  // run this, and the answer is a variable, not a bug report.
  password = await promptHidden('  Password: ').catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}

if (password.length < 8) {
  console.error('The password must be at least 8 characters long.')
  process.exit(1)
}

const db = createPool({
  host: process.env.NUXT_MYSQL_HOST || 'localhost',
  user: process.env.NUXT_MYSQL_USER || 'root',
  password: process.env.NUXT_MYSQL_PASSWORD || '',
  database: process.env.NUXT_MYSQL_DATABASE || 'lokaltransfer',
  timezone: 'Z',
  ...(String(process.env.NUXT_MYSQL_SSL).toLowerCase() === 'true'
    ? {
        ssl: {
          rejectUnauthorized:
            String(process.env.NUXT_MYSQL_SSL_REJECT_UNAUTHORIZED).toLowerCase() !== 'false'
        }
      }
    : {})
})

try {
  const normalized = email.trim().toLowerCase()

  const [tables] = await db.execute(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    ['user']
  )
  if (tables.length === 0) {
    console.error(
      'The database schema does not exist yet. Start the app once (npm run dev) so the '
      + 'migrations run, then run this script again.'
    )
    process.exit(1)
  }

  const [existing] = await db.execute('SELECT id FROM `user` WHERE `email` = ?', [normalized])
  if (existing.length > 0) {
    console.error(`An account already exists for ${normalized}.`)
    process.exit(1)
  }

  const userId = randomUUID()
  const hashedPassword = await bcrypt.hash(password, 10)

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      'INSERT INTO `user` (`id`, `name`, `email`, `emailVerified`, `role`, `type`) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name.trim(), normalized, 1, 'admin', 'member']
    )
    await conn.execute(
      'INSERT INTO `account` (`id`, `accountId`, `providerId`, `userId`, `password`) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), normalized, 'local', userId, hashedPassword]
    )
    await conn.commit()
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }

  // The password is deliberately not echoed back. The operator chose it, so it
  // needs no conveying, and there is nothing here for a log to capture.
  console.log('\nAdministrator created.\n')
  console.log(`  E-mail:   ${normalized}`)
  console.log('')
} catch (error) {
  console.error('Failed to create the administrator:', error.message)
  process.exit(1)
} finally {
  await db.end()
}
