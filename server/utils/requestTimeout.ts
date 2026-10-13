import type { Server } from 'node:http'
import type { H3Event } from 'h3'

// Node gives a client five minutes to deliver a whole request, headers and body
// together (`server.requestTimeout`), and closes the connection when they run
// out. That is a sensible guard for a JSON API and fatal for this one: at
// 5 MB/s a 2 GB file takes nearly seven minutes, so the upload was cut off at
// the five-minute mark however healthy the connection — and the browser
// reported it as a lost network connection, not as anything the server said.
//
// The limit is a property of the server, not of a request, and Nitro creates the
// server without offering a place to configure it — so it is reached through
// the request's own socket.
//
// It is lifted only while an upload is actually running, and put back when the
// last one finishes. Switching it off for good would also switch it off for
// every endpoint a stranger can reach, where five minutes to send a few hundred
// bytes is still the right answer. Only a signed-in sender with a draft of their
// own gets as far as the call below.
//
// With no cap on the total, what bounds an upload is silence instead: see the
// idle timeout in the upload handler. As long as bytes keep arriving, an upload
// may take as long as it takes.

/**
 * How long an upload may go without a single byte arriving before it is given
 * up on. With no limit on its total duration, this is what stops a connection
 * that has died without saying so from being waited on for ever.
 */
export const UPLOAD_IDLE_TIMEOUT_MS = 2 * 60 * 1000

let uploadsRunning = 0
let usualTimeout: number | null = null

/**
 * Suspend the whole-request time limit for the duration of an upload.
 * Returns the function that ends the suspension; calling it twice is harmless.
 */
export function suspendRequestTimeout(event: H3Event): () => void {
  const server = (event.node.req.socket as { server?: Server } | null)?.server

  // In development the request arrives through a proxy and there is no server
  // here to adjust; nothing to do, and nothing to undo.
  if (!server || typeof server.requestTimeout !== 'number') return () => {}

  if (uploadsRunning === 0) {
    usualTimeout = server.requestTimeout
    server.requestTimeout = 0
  }
  uploadsRunning++

  let ended = false
  return () => {
    if (ended) return
    ended = true
    uploadsRunning--
    if (uploadsRunning === 0 && usualTimeout !== null) {
      server.requestTimeout = usualTimeout
      usualTimeout = null
    }
  }
}
