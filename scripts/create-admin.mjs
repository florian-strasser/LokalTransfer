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
// Reads the same NUXT_MYSQL_* variables as the app. Pass a password as the third
// argument, or let it generate one and print it once.

import { createPool } from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { randomBytes, randomUUID } from 'node:crypto'
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

const [name, email, providedPassword] = process.argv.slice(2)

if (!name || !email) {
  console.error('Usage: node scripts/create-admin.mjs "Full Name" email@example.com [password]')
  process.exit(1)
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`Not a valid e-mail address: ${email}`)
  process.exit(1)
}

// Same alphabet as the admin UI's generator: no characters that are ambiguous
// when read off a screen and typed somewhere else.
function generatePassword() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(20)
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}

const password = providedPassword || generatePassword()

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

  console.log('\nAdministrator created.\n')
  console.log(`  E-mail:   ${normalized}`)
  if (!providedPassword) {
    // Only ever printed to an interactive terminal.
    //
    // A generated password has to reach the operator somehow, and the console is
    // the only channel this script has. But when the output is redirected — a CI
    // job, `| tee setup.log`, `docker compose up` capturing container output —
    // the same line writes the administrator's password into a file that
    // outlives the run and is rarely treated as a secret. A TTY check keeps the
    // interactive case exactly as it was and refuses the case that leaks.
    if (process.stdout.isTTY) {
      console.log(`  Password: ${password}`)
      console.log('\nWrite this down now — it is not recoverable.\n')
    } else {
      console.log('  Password: (generated, not printed — output is not a terminal)')
      console.log(
        '\nRe-run this in a terminal, or pass a password as the third argument,'
        + '\nso it is not written into whatever is capturing this output.\n'
      )
    }
  }
} catch (error) {
  console.error('Failed to create the administrator:', error.message)
  process.exit(1)
} finally {
  await db.end()
}
