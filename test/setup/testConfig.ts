import { resolve } from 'node:path'

// The single description of what a test run looks like.
//
// Both halves of the suite read this: the unit and integration tests install it
// as the stubbed `useRuntimeConfig`, and the end-to-end tests hand the same
// values to the Nuxt server they start. That is what lets an e2e test assert
// against the database and the disk directly — both sides are pointed at the
// same test database and the same temporary storage root.

/** A database of its own. Tests truncate tables; they must never see dev data. */
export const TEST_DATABASE = process.env.NUXT_TEST_MYSQL_DATABASE || 'lokaltransfer_test'

/** Storage root for tests, under the repo so a stray file is easy to spot. */
export const TEST_STORAGE = resolve(process.cwd(), '.test-storage')

export const TEST_APP_URL = 'http://localhost:3000'

/**
 * The same settings as environment variables, for the Nuxt server the e2e tests
 * start.
 *
 * It has to be env rather than a `nuxtConfig` override: runtimeConfig values
 * from nuxt.config are the *defaults*, and a matching `NUXT_*` variable wins at
 * runtime. The repo's own `.env` supplies exactly those variables, so a
 * nuxtConfig override is silently overruled and the test server comes up on the
 * development database — which is how this was first written, and why nothing
 * the tests inserted was visible to it.
 */
export const testServerEnv: Record<string, string> = {
  // *Every* variable the app reads is set here, including the ones whose test
  // value happens to match the default. Anything left out falls through to the
  // repo's own `.env`, which describes a development machine and drifts with it —
  // that has already broken this suite twice, once by pointing the test server at
  // the development database, and once when `NUXT_MYSQL_SSL=true` was added for a
  // managed provider and the tests began negotiating TLS with a local MySQL.
  // Listing them all makes the test environment complete rather than a patch on
  // top of whatever `.env` happens to say.
  NUXT_APP_NAME: 'LokalTransfer',
  NUXT_APP_URL: TEST_APP_URL,
  NUXT_LANGUAGE: 'en',
  NUXT_TIMEZONE: 'UTC',

  NUXT_MYSQL_HOST: process.env.NUXT_TEST_MYSQL_HOST || 'localhost',
  NUXT_MYSQL_DATABASE: TEST_DATABASE,
  NUXT_MYSQL_USER: process.env.NUXT_TEST_MYSQL_USER || 'root',
  NUXT_MYSQL_PASSWORD: process.env.NUXT_TEST_MYSQL_PASSWORD || 'root1234',
  NUXT_MYSQL_SSL: 'false',
  NUXT_MYSQL_SSL_REJECT_UNAUTHORIZED: 'true',

  NUXT_STORAGE_PATH: TEST_STORAGE,
  NUXT_MAX_FILE_SIZE_MB: '16',
  NUXT_MAX_FILES_PER_TRANSFER: '50',
  NUXT_DEFAULT_RETENTION_DAYS: '14',
  NUXT_DRAFT_MAX_AGE_HOURS: '24',
  NUXT_EXPIRY_WARNING_HOURS: '24',

  NUXT_SESSION_MAX_AGE_DAYS: '7',
  NUXT_GUEST_SESSION_MAX_AGE_HOURS: '12',
  NUXT_MAGIC_LINK_MAX_AGE_MINUTES: '30',

  // Nothing leaves the machine: rendered and handed back, never delivered.
  NUXT_EMAIL_TRANSPORT: 'json',
  NUXT_EMAIL_HOST: 'localhost',
  NUXT_EMAIL_PORT: '465',
  NUXT_EMAIL_SECURE: 'false',
  NUXT_EMAIL_USER: 'tests@example.com',
  NUXT_EMAIL_PASS: 'unused',
  NUXT_EMAIL_FROM: 'tests@example.com',

  // No admin is seeded; each test creates the accounts it needs, so one test's
  // fixtures can never satisfy another's preconditions.
  NUXT_ADMIN_EMAIL: '',
  NUXT_ADMIN_PASSWORD: '',
  NUXT_ADMIN_NAME: 'Administrator',

  NUXT_PUBLIC_COLOR_PRIMARY: '#CC0030',
  NUXT_PUBLIC_COLOR_PRIMARY_DARK: '#DE0F3B',
  NUXT_PUBLIC_COLOR_NEUTRAL: '#71717A',
  NUXT_PUBLIC_COLOR_NEUTRAL_DARK: '#71717A',
  NUXT_PUBLIC_BACKGROUND_IMAGE: '',
  NUXT_PUBLIC_BACKGROUND_LINK: '',
  NUXT_PUBLIC_BACKGROUND_CREDIT: '',
  NUXT_PUBLIC_PRIVACY_URL: '',
  NUXT_PUBLIC_IMPRINT_URL: ''
}

export const testRuntimeConfig = {
  appName: 'LokalTransfer',
  language: 'en',
  appUrl: TEST_APP_URL,
  timezone: 'UTC',

  sessionMaxAgeDays: '7',
  guestSessionMaxAgeHours: '12',
  magicLinkMaxAgeMinutes: '30',

  // No admin is seeded during tests; each test creates exactly the accounts it
  // needs, so one test's fixtures can't satisfy another's preconditions.
  adminEmail: '',
  adminPassword: '',
  adminName: 'Administrator',

  storagePath: TEST_STORAGE,
  // Deliberately small, so the "file too large" branch can be proven without
  // pushing two gigabytes through the test.
  maxFileSizeMb: '16',
  maxFilesPerTransfer: '50',
  defaultRetentionDays: '14',
  draftMaxAgeHours: '24',
  expiryWarningHours: '24',

  // Read from NUXT_TEST_* rather than the app's own NUXT_MYSQL_* variables, so
  // pointing the suite at a different server never means editing the values the
  // application itself runs on.
  mysqlHost: process.env.NUXT_TEST_MYSQL_HOST || 'localhost',
  mysqlDatabase: TEST_DATABASE,
  mysqlUser: process.env.NUXT_TEST_MYSQL_USER || 'root',
  mysqlPassword: process.env.NUXT_TEST_MYSQL_PASSWORD || 'root1234',
  mysqlSsl: 'false',
  mysqlSslRejectUnauthorized: 'true',

  // Nothing leaves the machine: nodemailer renders the message and hands it
  // back. A test that requests a magic link must not put mail in a real inbox.
  emailHost: 'localhost',
  emailPort: '465',
  emailSecure: 'false',
  emailUser: 'tests@example.com',
  emailPass: 'unused',
  emailFrom: 'tests@example.com',
  emailTransport: 'json',

  public: {
    appName: 'LokalTransfer',
    language: 'en',
    colorPrimary: '#CC0030',
    colorPrimaryDark: '#DE0F3B',
    colorNeutral: '#71717A',
    colorNeutralDark: '#71717A',
    maxFileSizeMb: '16',
    maxFilesPerTransfer: '50',
    defaultRetentionDays: '14',
    backgroundImage: '',
    backgroundLink: '',
    backgroundCredit: '',
    privacyUrl: '',
    imprintUrl: '',
    timezone: 'UTC'
  }
}
