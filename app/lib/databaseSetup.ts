import type { RowDataPacket } from 'mysql2'
import { createPool, type Pool } from 'mysql2/promise'
import { logger } from '../../server/utils/logger'

// Database configuration is read from Nuxt's runtimeConfig so it can be changed
// per deployment without a rebuild, falling back to process.env for the rare
// case where this module is imported outside a Nitro context (scripts, tests).
// The `typeof` guard keeps the auto-imported global from throwing in plain Node.
// Only the database keys are read here, so the shape is declared narrowly rather
// than pulling in the whole RuntimeConfig type — which isn't available when this
// module is loaded outside Nitro.
type DatabaseConfig = Partial<Record<
  'mysqlHost' | 'mysqlUser' | 'mysqlPassword' | 'mysqlDatabase' | 'mysqlSsl' | 'mysqlSslRejectUnauthorized',
  string
>>

const runtimeConfig = (
  typeof useRuntimeConfig !== 'undefined' ? useRuntimeConfig() : null
) as DatabaseConfig | null

const mysqlHost = runtimeConfig?.mysqlHost ?? process.env.NUXT_MYSQL_HOST
const mysqlUser = runtimeConfig?.mysqlUser ?? process.env.NUXT_MYSQL_USER
const mysqlPassword = runtimeConfig?.mysqlPassword ?? process.env.NUXT_MYSQL_PASSWORD
const mysqlDatabase = runtimeConfig?.mysqlDatabase ?? process.env.NUXT_MYSQL_DATABASE

// TLS is opt-in so a local MySQL without certificates keeps working, while a
// managed database (the Mittwald instance this is headed for) can require it.
// Certificate verification stays on unless explicitly disabled.
const mysqlSsl
  = String(runtimeConfig?.mysqlSsl ?? process.env.NUXT_MYSQL_SSL).toLowerCase() === 'true'
const mysqlSslRejectUnauthorized
  = String(
    runtimeConfig?.mysqlSslRejectUnauthorized ?? process.env.NUXT_MYSQL_SSL_REJECT_UNAUTHORIZED
  ).toLowerCase() !== 'false'

const db = createPool({
  host: mysqlHost,
  user: mysqlUser,
  password: mysqlPassword,
  database: mysqlDatabase,
  // Parse DATETIME/TIMESTAMP columns as UTC. Everything this app stores is an
  // instant (an expiry, a send time), never a wall-clock date, so UTC end to end
  // is the only representation that survives a server in a different timezone.
  timezone: 'Z',
  // Uploads can add many rows in quick succession while a transfer is being
  // assembled; a slightly larger pool keeps that from serialising.
  connectionLimit: 15,
  ...(mysqlSsl ? { ssl: { rejectUnauthorized: mysqlSslRejectUnauthorized } } : {})
})

// Pin every pooled connection to UTC as well. The driver reads timestamps as UTC
// (`timezone: "Z"` above), so if the MySQL session were on local time, `NOW()`
// would return local wall-clock that the driver then reinterprets as UTC —
// silently shifting every expiry by the server's offset. `+00:00` is a fixed
// offset, so it works without MySQL's named timezone tables being installed.
db.on('connection', (connection) => {
  connection.query('SET time_zone = \'+00:00\';')
})

/**
 * Return the shared MySQL connection pool.
 *
 * The schema is created and brought up to date once at startup by
 * `runMigrations()` (from the `server/plugins/0.database-migrate.ts` Nitro
 * plugin), so request handlers just take the pool from here.
 */
export function setupDatabase() {
  return db
}

// --- Schema migrations -------------------------------------------------------

interface Migration {
  // Stable, ordered identifier. Never change an id once it has shipped.
  id: string
  up: (db: Pool) => Promise<void>
}

// A migration's id is only recorded after `up()` resolves, so a crash partway
// through re-runs the whole migration. MySQL has no "ADD COLUMN IF NOT EXISTS",
// so ask the catalogue rather than letting the retry die on "Duplicate column
// name" — which would wedge startup permanently.
async function columnExists(db: Pool, table: string, column: string) {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  )
  return rows.length > 0
}

// Ordered list of migrations. To evolve the schema, append a new entry — never
// edit or remove an existing one, it may already be applied in the wild.
const migrations: Migration[] = [
  {
    // Baseline schema. Uses CREATE TABLE IF NOT EXISTS so it is safe to run
    // against a database that already holds these tables.
    id: '0001_baseline_schema',
    up: async (db) => {
      // Both internal team members and external guests live in one table, told
      // apart by `type`. That keeps sessions, bans and the admin UI uniform;
      // what differs is only how you authenticate (password vs magic link) and
      // what you're allowed to do.
      await db.execute(`CREATE TABLE IF NOT EXISTS \`user\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`emailVerified\` tinyint(1) NOT NULL DEFAULT '0',
        \`image\` longtext,
        \`createdAt\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`role\` varchar(10) NOT NULL DEFAULT 'user',
        \`type\` enum('member','guest') NOT NULL DEFAULT 'member',
        \`company\` varchar(255) DEFAULT NULL,
        \`banned\` tinyint(1) DEFAULT NULL,
        \`banReason\` text,
        \`banExpires\` timestamp(3) NULL DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`user_email_unique\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`)

      // Password credentials, split from `user` so a guest simply has no row
      // here — there is no password to brute-force against a guest account.
      await db.execute(`CREATE TABLE IF NOT EXISTS \`account\` (
        \`id\` varchar(36) NOT NULL,
        \`accountId\` varchar(255) NOT NULL,
        \`providerId\` varchar(50) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`password\` text,
        \`createdAt\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`account_user\` (\`userId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`)

      await db.execute(`CREATE TABLE IF NOT EXISTS \`session\` (
        \`id\` varchar(36) NOT NULL,
        \`expiresAt\` timestamp(3) NOT NULL,
        \`token\` varchar(255) NOT NULL,
        \`createdAt\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`ipAddress\` text,
        \`userAgent\` text,
        \`userId\` varchar(36) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`session_token_unique\` (\`token\`),
        KEY \`session_user\` (\`userId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`)

      // One-time tokens. `purpose` keeps password resets and magic links apart
      // so a token minted for one can never be redeemed for the other.
      await db.execute(`CREATE TABLE IF NOT EXISTS \`verification\` (
        \`id\` varchar(36) NOT NULL,
        \`identifier\` varchar(255) NOT NULL,
        \`value\` varchar(255) NOT NULL,
        \`purpose\` enum('password_reset','magic_link') NOT NULL DEFAULT 'password_reset',
        \`expiresAt\` timestamp(3) NOT NULL,
        \`createdAt\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`verification_value_unique\` (\`value\`),
        KEY \`verification_identifier\` (\`identifier\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`)

      // A transfer is one send: some files, some recipients, one expiry.
      //
      // `status` distinguishes a transfer still being uploaded ("draft") from
      // one that has been sent. Only sent transfers are downloadable, and drafts
      // are swept by the cleanup task so an abandoned upload can't sit on disk
      // forever.
      //
      // `expiresAt` NULL means "keep forever" — the unlimited retention option.
      // Using NULL rather than a far-future date means the cleanup query can
      // simply ignore those rows instead of relying on a sentinel date.
      await db.execute(`CREATE TABLE IF NOT EXISTS \`transfers\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`token\` varchar(64) NOT NULL,
        \`senderId\` varchar(36) DEFAULT NULL,
        \`senderName\` varchar(255) NOT NULL,
        \`senderEmail\` varchar(255) NOT NULL,
        \`kind\` enum('outgoing','guest') NOT NULL DEFAULT 'outgoing',
        \`subject\` varchar(255) DEFAULT NULL,
        \`message\` text,
        \`status\` enum('draft','sent') NOT NULL DEFAULT 'draft',
        \`retentionDays\` int DEFAULT NULL,
        \`expiresAt\` timestamp NULL DEFAULT NULL,
        \`downloadCount\` int NOT NULL DEFAULT '0',
        \`lastDownloadAt\` timestamp NULL DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`sentAt\` timestamp NULL DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`transfers_token_unique\` (\`token\`),
        KEY \`transfers_sender\` (\`senderId\`),
        KEY \`transfers_expiry\` (\`status\`, \`expiresAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`)

      // `storedName` is the random on-disk name; `filename` is what the user
      // uploaded and what they get back on download. Keeping them separate means
      // a hostile filename never reaches the filesystem.
      await db.execute(`CREATE TABLE IF NOT EXISTS \`transfer_files\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`transfer\` int NOT NULL,
        \`filename\` varchar(255) NOT NULL,
        \`storedName\` varchar(255) NOT NULL,
        \`mimeType\` varchar(150) NOT NULL DEFAULT 'application/octet-stream',
        \`size\` bigint NOT NULL DEFAULT '0',
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`transfer_files_transfer\` (\`transfer\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`)

      // Recipients are stored as rows rather than a JSON blob so "which
      // transfers were sent to this address" stays a plain indexed query.
      // `userId` is set when the recipient is a known member (every guest
      // upload), and NULL for a free-text external address.
      await db.execute(`CREATE TABLE IF NOT EXISTS \`transfer_recipients\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`transfer\` int NOT NULL,
        \`userId\` varchar(36) DEFAULT NULL,
        \`email\` varchar(255) NOT NULL,
        \`name\` varchar(255) DEFAULT NULL,
        \`notifiedAt\` timestamp NULL DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`transfer_recipients_transfer\` (\`transfer\`),
        KEY \`transfer_recipients_email\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`)
    }
  },

  {
    // Share options: an optional password, a presentation layout, and a
    // per-transfer background image.
    //
    // `passwordHash` NULL means the link alone is enough — the token is still
    // 256 bits of entropy, so the password is a second factor against a link
    // being forwarded rather than the only thing protecting the files.
    //
    // `backgroundName` is a file inside the transfer's own storage directory, so
    // it is removed along with everything else when the transfer expires.
    //
    // Each column is added only if it is missing. The runner records a migration
    // as applied *after* it succeeds, so a process killed between the ALTER and
    // that record would re-run this on the next boot and fail on a duplicate
    // column — permanently, since the instance can never get past it. Checking
    // first makes a re-run a no-op instead.
    id: '0002_transfer_share_options',
    up: async (db) => {
      const columns: [string, string][] = [
        ['passwordHash', 'varchar(255) DEFAULT NULL'],
        ['layout', 'enum(\'list\',\'gallery\') NOT NULL DEFAULT \'list\''],
        ['backgroundName', 'varchar(255) DEFAULT NULL']
      ]

      for (const [name, definition] of columns) {
        if (await columnExists(db, 'transfers', name)) continue
        await db.execute(`ALTER TABLE \`transfers\` ADD COLUMN \`${name}\` ${definition}`)
      }
    }
  },

  {
    // API keys, for the REST API and the MCP server.
    //
    // `key` holds a SHA-256 hash, never the plaintext — a leaked database is
    // then useless for impersonation, and verification stays a single indexed
    // equality lookup. (A slow password hash would be the wrong tool here: the
    // input is a 256-bit random token, not a human-chosen secret, and bcrypt
    // can't be looked up by equality so every stored key would have to be
    // compared in turn.)
    //
    // `start` keeps the first characters so a key is recognisable in the UI
    // after its plaintext is gone.
    //
    // `permissions` is a JSON array of scopes, or NULL for unrestricted. Only
    // `read` and `write` are used today.
    id: '0003_api_keys',
    up: async (db) => {
      await db.execute(`CREATE TABLE IF NOT EXISTS \`apikey\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`start\` varchar(16) NOT NULL,
        \`key\` varchar(64) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`permissions\` text,
        \`enabled\` tinyint(1) NOT NULL DEFAULT '1',
        \`expiresAt\` timestamp NULL DEFAULT NULL,
        \`lastUsedAt\` timestamp NULL DEFAULT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`apikey_key_unique\` (\`key\`),
        KEY \`apikey_user\` (\`userId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`)
    }
  },

  {
    // Marks the moment a sender was warned that a transfer is about to expire.
    //
    // A timestamp rather than a boolean: it says *when*, which is what you want
    // when someone asks why they did or didn't get a warning. NULL means "not
    // warned", which is also the correct state for every transfer that existed
    // before this column did.
    //
    // Writing it is what makes the warning fire exactly once — the sweep runs
    // every 15 minutes and would otherwise re-send on each pass for the whole
    // length of the warning window.
    // Added conditionally, for the same reason as 0002: a re-run after an
    // interrupted boot must be a no-op rather than a permanent failure.
    id: '0004_expiry_warning',
    up: async (db) => {
      if (await columnExists(db, 'transfers', 'expiryWarningSentAt')) return
      await db.execute(
        'ALTER TABLE `transfers` ADD COLUMN `expiryWarningSentAt` timestamp NULL DEFAULT NULL'
      )
    }
  }
]

let schemaPromise: Promise<void> | null = null

/**
 * Resolve once the schema is up to date.
 *
 * Anything that touches a table during startup must await this first. Nitro does
 * not guarantee plugin execution order from the filename prefix — the admin
 * bootstrap plugin was observed running before the migration plugin on a fresh
 * database, which only fails when the tables genuinely don't exist yet, i.e.
 * exactly the first-run case. Making the dependency explicit removes the
 * ordering assumption entirely.
 *
 * Memoized: whichever caller arrives first performs the migration and the rest
 * await the same promise. A rejection is cached deliberately — if the schema is
 * in an unknown state, retrying against it is worse than failing.
 */
export function schemaReady(): Promise<void> {
  schemaPromise ??= runMigrations()
  return schemaPromise
}

// Name of the advisory lock that serialises migration runs. Scoped to the
// database by MySQL itself — `GET_LOCK` names are server-wide, so the database
// name is included to keep two instances on one server out of each other's way.
const MIGRATION_LOCK = 'lokaltransfer_migrations'

// How long to wait for another process to finish migrating before giving up.
// Generous, because the wait is for someone else's ALTER TABLE on what may be a
// large table, and failing early would only crash-loop the container.
const MIGRATION_LOCK_TIMEOUT_SECONDS = 120

/**
 * Apply any migrations that haven't run yet, in order.
 *
 * Ids are recorded in `_migrations` after the migration succeeds, so this is
 * safe to call on every boot. Prefer `schemaReady()` — it deduplicates within a
 * process.
 *
 * Across processes it is serialised with a MySQL advisory lock. Without one,
 * two processes starting against the same fresh database both read an empty
 * `_migrations`, both decide the same migration is outstanding, and the second
 * one's `ALTER TABLE` fails with a duplicate column. That is not hypothetical:
 * it is what CI hit on its first run, where the database really was new — and it
 * would equally hit a rolling deploy or a second replica, since nothing stops
 * two containers booting at once.
 *
 * The lock is held on its own pooled connection because `GET_LOCK` is scoped to
 * a connection, and the migrations themselves run through the pool, which hands
 * out whichever connection is free.
 */
export async function runMigrations() {
  const db = setupDatabase()

  const lock = await db.getConnection()
  try {
    const [rows] = await lock.query<RowDataPacket[]>(
      'SELECT GET_LOCK(?, ?) AS acquired',
      [MIGRATION_LOCK, MIGRATION_LOCK_TIMEOUT_SECONDS]
    )

    // 0 means the wait timed out; NULL means the attempt itself errored.
    if (Number(rows[0]?.acquired) !== 1) {
      throw new Error(
        `Timed out waiting ${MIGRATION_LOCK_TIMEOUT_SECONDS}s for another process to finish migrating`
      )
    }

    await db.execute(`CREATE TABLE IF NOT EXISTS \`_migrations\` (
      \`id\` varchar(255) NOT NULL,
      \`appliedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`)

    // Read *after* the lock is held. Reading before would reintroduce exactly
    // the stale view the lock exists to prevent.
    const [applied] = await db.execute<RowDataPacket[]>('SELECT `id` FROM `_migrations`')
    const done = new Set(applied.map((row: RowDataPacket) => row.id))

    for (const migration of migrations) {
      if (done.has(migration.id)) continue

      logger.info('Applying migration', { id: migration.id })
      await migration.up(db)
      await db.execute('INSERT INTO `_migrations` (`id`) VALUES (?)', [migration.id])
    }
  } finally {
    // Released explicitly rather than left to the connection closing, since the
    // connection goes back to the pool alive and would hold the lock for the
    // life of the process.
    await lock.query('SELECT RELEASE_LOCK(?)', [MIGRATION_LOCK]).catch(() => {})
    lock.release()
  }
}

// Exported for use by future migrations that add columns conditionally.
export { columnExists }
