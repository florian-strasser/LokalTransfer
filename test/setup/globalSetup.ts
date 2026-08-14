import { createConnection } from 'mysql2/promise'
import { promises as fs } from 'node:fs'
import { TEST_DATABASE, TEST_STORAGE, testRuntimeConfig } from './testConfig'

// Runs once before the whole suite: create the test database and clear the test
// storage root. The schema itself is left to the app's own migration runner, so
// the tests exercise the same path a fresh deployment takes rather than a
// hand-maintained copy of the schema that could drift from it.

export async function setup() {
  const connection = await createConnection({
    host: testRuntimeConfig.mysqlHost,
    user: testRuntimeConfig.mysqlUser,
    password: testRuntimeConfig.mysqlPassword,
    multipleStatements: false
  })

  // Guard rail. Dropping tables is the first thing the suite does, and a
  // misconfigured host variable pointing this at the development database would
  // be unrecoverable. The name has to say it is a test database.
  if (!/test/i.test(TEST_DATABASE)) {
    throw new Error(
      `Refusing to run tests against "${TEST_DATABASE}" — the test database name must contain "test".`
    )
  }

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${TEST_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
  )
  await connection.end()

  await fs.rm(TEST_STORAGE, { recursive: true, force: true })
  await fs.mkdir(TEST_STORAGE, { recursive: true })
}

export async function teardown() {
  // The database is left in place: it costs nothing, and being able to look at
  // the rows after a failing run is worth more than a clean slate. Storage goes,
  // because uploaded fixtures are large and tell you nothing after the fact.
  await fs.rm(TEST_STORAGE, { recursive: true, force: true })
}
