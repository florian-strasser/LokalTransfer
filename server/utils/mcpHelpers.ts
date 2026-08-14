import { z } from 'zod'
import type { SessionUser } from './auth'

// Shared helpers for the MCP tools: identity, scope checks, stable error codes
// and consistent serialization.
//
// Tools throw `McpError` on failure. The toolkit turns a thrown error into an
// MCP `isError` result, so the agent receives a machine-parseable `CODE: message`
// rather than prose it has to interpret.

export type McpErrorCode
  = 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VALIDATION'
    | 'INTERNAL'

export class McpError extends Error {
  constructor(public code: McpErrorCode, message: string) {
    super(`${code}: ${message}`)
    this.name = 'McpError'
  }
}

/**
 * The user the API key acts for, put on the event context by the MCP middleware.
 * Throws UNAUTHORIZED when the key is missing, unknown, disabled or expired —
 * the tool never sees which.
 */
export function requireMcpUser(): SessionUser {
  const event = useEvent()
  const user = event.context?.user as SessionUser | undefined

  if (!user?.id) {
    throw new McpError(
      'UNAUTHORIZED',
      'Missing or invalid API key. Send it in the `x-api-key` header. Create one under Account → API keys.'
    )
  }

  return user
}

/**
 * Require an internal team member.
 *
 * Guests exist to drop files off for someone here, through a flow with its own
 * rules — they may only address team members, and they don't choose retention.
 * Rather than teach every tool those rules, the MCP surface is member-only. In
 * practice keys are issued to members anyway; this keeps it true by construction.
 */
export function requireMcpMember() {
  const user = requireMcpUser()
  if (user.type !== 'member') {
    throw new McpError(
      'FORBIDDEN',
      'This tool is available to team members only. Guest accounts upload through the web interface.'
    )
  }
  return user
}

/**
 * Gate a mutating tool on the key's scopes.
 *
 * The REST side derives this from the HTTP method, which MCP has no equivalent
 * of — a tool call is a POST whatever it does. So write tools declare themselves
 * by calling this.
 */
export function requireMcpWrite(): void {
  const event = useEvent()
  const permissions = event.context?.apiKeyPermissions as string[] | null | undefined

  if (Array.isArray(permissions) && !permissions.includes('write')) {
    throw new McpError(
      'FORBIDDEN',
      'This API key is read-only; it cannot create, send or delete transfers.'
    )
  }
}

/** Whether the calling key is read-only, for tools that report capability. */
export function isReadOnlyKey(): boolean {
  const event = useEvent()
  const permissions = event.context?.apiKeyPermissions as string[] | null | undefined
  return Array.isArray(permissions) && !permissions.includes('write')
}

// --- Shared input fields -----------------------------------------------------

export const transferIdInput = {
  transferId: z
    .number()
    .int()
    .positive()
    .describe('The numeric transfer id, as returned by listTransfers.')
}

// --- Serialization -----------------------------------------------------------
//
// One shape for a transfer everywhere, so an agent that learned it from
// listTransfers can read getTransfer without relearning. Notably absent: the
// download token on list results — see serializeTransfer.

export interface SerializableTransfer {
  id: number
  token?: string
  subject: string | null
  message?: string | null
  status: string
  kind: string
  layout?: string
  expiresAt: Date | string | null
  downloadCount?: number
  createdAt?: Date | string
  sentAt?: Date | string | null
  fileCount?: number
  totalSize?: number
  recipients?: string | null
  hasPassword?: boolean | number
}

export function serializeTransfer(row: SerializableTransfer, appUrl: string) {
  return {
    transferId: Number(row.id),
    subject: row.subject ?? null,
    message: row.message ?? null,
    status: row.status,
    // "guest" means an outside contact uploaded it to a team member.
    kind: row.kind,
    layout: row.layout ?? 'list',
    // Absolute, because an agent has no page context to resolve a path against.
    downloadUrl: row.token ? `${appUrl}/d/${row.token}` : null,
    passwordProtected: !!row.hasPassword,
    fileCount: row.fileCount === undefined ? undefined : Number(row.fileCount),
    totalSize: row.totalSize === undefined ? undefined : Number(row.totalSize),
    downloadCount: row.downloadCount === undefined ? undefined : Number(row.downloadCount),
    recipients: row.recipients
      ? String(row.recipients).split(', ').filter(Boolean)
      : [],
    // Null expiry is meaningful — it is the "keep forever" option, not missing data.
    expiresAt: row.expiresAt ?? null,
    sentAt: row.sentAt ?? null,
    createdAt: row.createdAt ?? null
  }
}

/** The instance's public base URL, for building absolute download links. */
export function appUrl(): string {
  return String(useRuntimeConfig().appUrl).replace(/\/+$/, '')
}
