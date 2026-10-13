import type { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { suspendRequestTimeout } from '../../server/utils/requestTimeout'

// The limit lives on the server and is shared by every request, so the thing to
// get right is the bookkeeping: off while any upload runs, back on — at its
// original value — only when the last one has finished.

const NODE_DEFAULT = 300_000

function fakeEvent(server: { requestTimeout: number } | undefined) {
  return { node: { req: { socket: server ? { server } : {} } } } as unknown as H3Event
}

describe('suspendRequestTimeout', () => {
  it('lifts the limit for an upload and restores it afterwards', () => {
    const server = { requestTimeout: NODE_DEFAULT }
    const resume = suspendRequestTimeout(fakeEvent(server))
    expect(server.requestTimeout).toBe(0)
    resume()
    expect(server.requestTimeout).toBe(NODE_DEFAULT)
  })

  it('keeps it lifted until the last of several uploads has finished', () => {
    const server = { requestTimeout: NODE_DEFAULT }
    const first = suspendRequestTimeout(fakeEvent(server))
    const second = suspendRequestTimeout(fakeEvent(server))

    first()
    expect(server.requestTimeout, 'one upload still running').toBe(0)
    second()
    expect(server.requestTimeout).toBe(NODE_DEFAULT)
  })

  it('counts each upload once, however often it is ended', () => {
    // An upload can end on more than one path — the handler's `finally` after an
    // abort, say. A second call must not hand back another upload's suspension.
    const server = { requestTimeout: NODE_DEFAULT }
    const first = suspendRequestTimeout(fakeEvent(server))
    const second = suspendRequestTimeout(fakeEvent(server))

    first()
    first()
    expect(server.requestTimeout, 'the second upload is still running').toBe(0)
    second()
    expect(server.requestTimeout).toBe(NODE_DEFAULT)
  })

  it('puts back whatever the limit was, not a number of its own', () => {
    const server = { requestTimeout: 45_000 }
    suspendRequestTimeout(fakeEvent(server))()
    expect(server.requestTimeout).toBe(45_000)
  })

  it('does nothing where there is no server to adjust', () => {
    // The development server hands requests over through a proxy.
    expect(() => suspendRequestTimeout(fakeEvent(undefined))()).not.toThrow()
  })
})
