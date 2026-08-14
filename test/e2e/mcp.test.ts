import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { $fetch, setup, url } from '@nuxt/test-utils/e2e'
import { testServerEnv } from '../setup/testConfig'
import { createTestUser, migrateTestDatabase, resetState, type TestUser } from '../setup/db'

// The MCP server, driven over its real JSON-RPC transport rather than by calling
// the tool handlers directly — the auth middleware, the scope check and the
// error mapping all live in the transport layer, and those are the parts worth
// proving.

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  build: true,
  env: testServerEnv
})

const MCP_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream'
}

/** Minimal MCP client: initialize, then issue one call on the same session. */
async function mcp(apiKey: string | null, method: string, params: unknown = {}) {
  const auth = apiKey ? { 'x-api-key': apiKey } : {}

  const handshake = await fetch(url('/mcp'), {
    method: 'POST',
    headers: { ...MCP_HEADERS, ...auth },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'vitest', version: '1' }
      }
    })
  })

  const sessionId = handshake.headers.get('mcp-session-id')

  const response = await fetch(url('/mcp'), {
    method: 'POST',
    headers: {
      ...MCP_HEADERS,
      ...auth,
      ...(sessionId ? { 'mcp-session-id': sessionId } : {})
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method, params })
  })

  return await response.json() as {
    result?: { tools?: { name: string }[], content?: { text: string }[], isError?: boolean }
    error?: { message: string }
  }
}

interface ToolOutcome { ok: boolean, data: Record<string, unknown>, text: string }

/** Call a tool and unwrap it into either parsed JSON or an error string. */
async function callTool(apiKey: string | null, name: string, args: Record<string, unknown> = {}): Promise<ToolOutcome> {
  const response = await mcp(apiKey, 'tools/call', { name, arguments: args })
  const text = response.result?.content?.[0]?.text ?? response.error?.message ?? ''

  if (response.result?.isError || !response.result?.content) {
    return { ok: false, data: {}, text }
  }
  return { ok: true, data: JSON.parse(text), text }
}

async function signIn(user: TestUser): Promise<string> {
  const response = await fetch(url('/api/auth/sign-in'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password })
  })
  expect(response.status).toBe(200)
  return response.headers.getSetCookie()
    .find(c => c.startsWith('session_token='))!.split(';')[0]!
}

async function createKey(cookie: string, body: Record<string, unknown> = {}) {
  const result = await $fetch<{ data: { id: string, key: string } }>('/api/auth/api-key', {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: { name: 'MCP key', ...body }
  })
  return result.data
}

let member: TestUser
let other: TestUser
let key: string
let readOnlyKey: string
let otherKey: string

beforeAll(async () => {
  await migrateTestDatabase()
})

beforeEach(async () => {
  await resetState()
  member = await createTestUser({ name: 'Member', role: 'admin' })
  other = await createTestUser({ name: 'Other', role: 'user' })

  const cookie = await signIn(member)
  key = (await createKey(cookie)).key
  readOnlyKey = (await createKey(cookie, { name: 'Reader', readOnly: true })).key
  otherKey = (await createKey(await signIn(other), { name: 'Other key' })).key
})

describe('the server itself', () => {
  it('advertises every tool', async () => {
    const response = await mcp(key, 'tools/list')
    const names = (response.result?.tools ?? []).map(t => t.name).sort()

    expect(names).toEqual([
      'createTransfer',
      'deleteTransfer',
      'getTransfer',
      'listRecipients',
      'listTransfers',
      'sendTransfer',
      'whoami'
    ])
  })
})

describe('authentication', () => {
  it('reports the acting account and the key\'s scope', async () => {
    const full = await callTool(key, 'whoami')
    expect(full.ok).toBe(true)
    expect(full.data.email).toBe(member.email)
    expect(full.data.readOnlyKey).toBe(false)

    const limited = await callTool(readOnlyKey, 'whoami')
    expect(limited.data.readOnlyKey).toBe(true)
  })

  it('refuses a call with no key, and says how to fix it', async () => {
    const outcome = await callTool(null, 'whoami')
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('UNAUTHORIZED')
    // The message has to be actionable: an agent has no other way to discover
    // which header carries the credential.
    expect(outcome.text).toContain('x-api-key')
  })

  it('refuses an unknown key', async () => {
    const outcome = await callTool('0'.repeat(64), 'whoami')
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('UNAUTHORIZED')
  })
})

describe('read-only keys', () => {
  it('may read', async () => {
    const outcome = await callTool(readOnlyKey, 'listTransfers')
    expect(outcome.ok).toBe(true)
    expect(outcome.data.transfers).toEqual([])
  })

  it('may not create, send or delete', async () => {
    // MCP has no HTTP verb to key the scope check off — every tool call is a
    // POST — so each mutating tool declares itself. A tool that forgot to would
    // be silently writable with a read-only key, which is what this catches.
    for (const [tool, args] of [
      ['createTransfer', { subject: 'nope' }],
      ['sendTransfer', { transferId: 1 }],
      ['deleteTransfer', { transferId: 1 }]
    ] as const) {
      const outcome = await callTool(readOnlyKey, tool, args)
      expect(outcome.ok, tool).toBe(false)
      expect(outcome.text, tool).toContain('FORBIDDEN')
    }
  })
})

describe('the transfer lifecycle', () => {
  it('creates a draft, describes the upload step, sends it and reads it back', async () => {
    const created = await callTool(key, 'createTransfer', {
      recipients: ['client@example.com'],
      subject: 'Agent transfer',
      retentionDays: 7
    })
    expect(created.ok).toBe(true)
    expect(created.data.status).toBe('draft')
    expect(created.data.linkOnly).toBe(false)

    const transferId = created.data.transferId as number

    // File bytes cannot travel through a tool call, so the URL to POST them to
    // has to be part of the response or an agent is stuck.
    expect(created.data.uploadUrl).toBe(
      `${testServerEnv.NUXT_APP_URL}/api/transfers/${transferId}/files`
    )

    // Sending before there are any files is refused, with a message that says
    // what to do about it.
    const premature = await callTool(key, 'sendTransfer', { transferId })
    expect(premature.ok).toBe(false)
    expect(premature.text).toContain('no files')

    // Upload over HTTP, as the instructions describe.
    const form = new FormData()
    form.append('file', new Blob(['agent contents']), 'agent.txt')
    const upload = await fetch(url(`/api/transfers/${transferId}/files`), {
      method: 'POST',
      headers: { 'x-api-key': key },
      body: form
    })
    expect(upload.status).toBe(200)

    const sent = await callTool(key, 'sendTransfer', { transferId })
    expect(sent.ok).toBe(true)
    expect(sent.data.status).toBe('sent')
    expect(String(sent.data.downloadUrl)).toContain('/d/')

    // Idempotent: a retrying agent must not mail everyone twice.
    const again = await callTool(key, 'sendTransfer', { transferId })
    expect(again.ok).toBe(false)
    expect(again.text).toContain('already been sent')

    const fetched = await callTool(key, 'getTransfer', { transferId })
    expect(fetched.data.subject).toBe('Agent transfer')
    expect(fetched.data.youAre).toBe('sender')
    expect(fetched.data.recipients).toEqual(['client@example.com'])
    expect(fetched.data.files).toEqual([
      { filename: 'agent.txt', size: 14, mimeType: expect.any(String) }
    ])

    const listed = await callTool(key, 'listTransfers')
    expect((listed.data.transfers as unknown[])).toHaveLength(1)
  })

  it('creates a link-only transfer when no recipients are given', async () => {
    const created = await callTool(key, 'createTransfer', { subject: 'Just a link' })
    expect(created.data.linkOnly).toBe(true)
    expect(created.data.recipients).toEqual([])
  })

  it('validates retention and addresses before writing anything', async () => {
    const badRetention = await callTool(key, 'createTransfer', { retentionDays: 5 })
    expect(badRetention.ok).toBe(false)
    expect(badRetention.text).toContain('VALIDATION')

    const badEmail = await callTool(key, 'createTransfer', { recipients: ['not-an-email'] })
    expect(badEmail.ok).toBe(false)
    expect(badEmail.text).toContain('VALIDATION')

    // Neither attempt may leave a draft behind for the sweep to collect.
    const listed = await callTool(key, 'listTransfers')
    expect(listed.data.transfers).toEqual([])
  })

  it('deletes a transfer it owns', async () => {
    const created = await callTool(key, 'createTransfer', { subject: 'Temporary' })
    const transferId = created.data.transferId as number

    const deleted = await callTool(key, 'deleteTransfer', { transferId })
    expect(deleted.ok).toBe(true)
    expect(deleted.data.deleted).toBe(true)

    const gone = await callTool(key, 'getTransfer', { transferId })
    expect(gone.ok).toBe(false)
    expect(gone.text).toContain('NOT_FOUND')
  })

  it('lists the team members a transfer can be addressed to', async () => {
    const outcome = await callTool(key, 'listRecipients')
    expect(outcome.data.count).toBe(2)

    const members = outcome.data.members as { email: string, isYou: boolean }[]
    expect(members.find(m => m.email === member.email)!.isYou).toBe(true)
    expect(members.find(m => m.email === other.email)!.isYou).toBe(false)
  })
})

describe('isolation between accounts', () => {
  it('cannot read, send or delete another account\'s transfer', async () => {
    const created = await callTool(key, 'createTransfer', { subject: 'Private' })
    const transferId = created.data.transferId as number

    for (const tool of ['getTransfer', 'sendTransfer', 'deleteTransfer'] as const) {
      const outcome = await callTool(otherKey, tool, { transferId })
      expect(outcome.ok, tool).toBe(false)
      // NOT_FOUND rather than FORBIDDEN throughout, so ids cannot be probed for
      // existence by watching which error comes back.
      expect(outcome.text, tool).toContain('NOT_FOUND')
    }
  })

  it('shows a recipient the transfer without revealing the other recipients', async () => {
    const created = await callTool(key, 'createTransfer', {
      recipients: [other.email, 'someone-else@example.com'],
      subject: 'For the team'
    })
    const transferId = created.data.transferId as number

    const form = new FormData()
    form.append('file', new Blob(['data']), 'a.txt')
    await fetch(url(`/api/transfers/${transferId}/files`), {
      method: 'POST',
      headers: { 'x-api-key': key },
      body: form
    })
    await callTool(key, 'sendTransfer', { transferId })

    const asRecipient = await callTool(otherKey, 'getTransfer', { transferId })
    expect(asRecipient.ok).toBe(true)
    expect(asRecipient.data.youAre).toBe('recipient')
    // One recipient must not be able to harvest the others.
    expect(asRecipient.data.recipients).toEqual([])
    expect(asRecipient.text).not.toContain('someone-else@example.com')

    const received = await callTool(otherKey, 'listTransfers', { direction: 'received' })
    expect((received.data.transfers as unknown[])).toHaveLength(1)
  })
})
