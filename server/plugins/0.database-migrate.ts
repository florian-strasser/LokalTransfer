import { schemaReady } from '../../app/lib/databaseSetup'
import { logger } from '../utils/logger'

// Bring the database schema up to date once at server startup, before any
// request is served. Nitro awaits async plugins during initialisation, so the
// schema is ready by the time the server starts handling traffic.
//
// Goes through `schemaReady()` rather than `runMigrations()` directly so that the
// admin bootstrap plugin can await the same promise — Nitro doesn't guarantee
// plugin order, and this way it doesn't have to.
export default defineNitroPlugin(async () => {
  try {
    await schemaReady()
  } catch (err) {
    // Fail fast: don't serve traffic against a database with an unknown schema.
    logger.error('Database migration failed', err)
    throw err
  }
})
