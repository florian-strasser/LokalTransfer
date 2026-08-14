import { setupDatabase } from '../../app/lib/databaseSetup'

// Liveness and readiness in one endpoint, for the container's HEALTHCHECK and
// for whatever sits in front of it.
//
// It checks the database rather than only that the process is listening, because
// an instance that cannot reach its database can serve neither a download nor an
// upload — reporting it healthy would keep a broken container in a load
// balancer's rotation.
//
// Deliberately unauthenticated and deliberately terse: the response says whether
// the instance works, and nothing about what it is or what version it runs, since
// anything more is reconnaissance handed to whoever finds the URL.
export default defineEventHandler(async (event) => {
  try {
    const db = setupDatabase()
    await db.execute('SELECT 1')
    return { status: 'ok' }
  } catch {
    setResponseStatus(event, 503)
    return { status: 'error' }
  }
})
