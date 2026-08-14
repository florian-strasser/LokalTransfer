import { getApiKeyUser } from '../utils/auth'

// The MCP server, letting an AI agent send and manage transfers on someone's
// behalf. Every request authenticates with the caller's API key (`x-api-key`);
// the middleware resolves it to a user plus the key's scopes and puts both on the
// event context for the tools (see server/utils/mcpHelpers.ts).
//
// This is the part that makes LokalTransfer something WeTransfer isn't: an agent
// can hand a client their files directly, on your own server, without a human
// driving a browser.
export default defineMcpHandler({
  instructions: [
    'LokalTransfer is a self-hosted file transfer service. Use these tools to send',
    'files to people and to manage transfers on the user\'s behalf.',
    '',
    'Data model:',
    '- A **transfer** is one send: some files, zero or more recipients, one expiry.',
    '- It stays a **draft** while files are being added, and becomes **sent** when',
    '  you send it. Only a sent transfer is downloadable.',
    '- Recipients get an e-mail with a download link. A transfer with **no**',
    '  recipients is link-only: nothing is e-mailed and you pass the link on',
    '  yourself.',
    '- Every transfer expires (14 days by default). At expiry the link stops',
    '  working and the files are deleted from the server for good.',
    '',
    'Authentication: send the user\'s API key in the `x-api-key` header. `whoami`',
    'returns who you are acting as and whether your key is read-only. A read-only',
    'key can call the read tools but not create, send or delete.',
    '',
    'Recommended flow for sending files:',
    '1. `whoami` to confirm the acting user.',
    '2. `createTransfer` with the recipients, a subject and how long it should',
    '   last. This returns a transferId and the transfer is a draft.',
    '3. Upload the files. **Uploading is not an MCP tool** — file bytes do not',
    '   belong in a tool call. POST each file to',
    '   `<appUrl>/api/transfers/<transferId>/files` as multipart/form-data with the',
    '   same `x-api-key` header. `createTransfer` returns the exact URL to use.',
    '4. `sendTransfer` to deliver it. This is what mails the recipients and starts',
    '   the expiry clock, and it returns the download link.',
    '',
    'If you only need a link to give someone, create the transfer with an empty',
    '`recipients` list: nothing is e-mailed and `sendTransfer` hands you the URL.',
    '',
    'Reading: `listTransfers` for what the user has sent and received,',
    '`getTransfer` for one transfer including its file list. `listRecipients`',
    'returns the team members you can address, which is what a guest-style upload',
    'needs.',
    '',
    'Expiry is the point of this tool, not an inconvenience — prefer a short',
    'retention and say so to the user, rather than defaulting to no expiry.',
    'Password protection is available via `password` on createTransfer; the',
    'password is NOT e-mailed to recipients, so tell the user to pass it on',
    'separately.',
    '',
    'Staying up to date: there is no push channel. Other people\'s changes only',
    'become visible when you call a read tool again.',
    '',
    'Errors come back as `CODE: message` where CODE is one of UNAUTHORIZED,',
    'FORBIDDEN, NOT_FOUND, VALIDATION, INTERNAL.'
  ].join('\n'),

  middleware: async (event) => {
    // Absent or invalid keys are left unauthenticated rather than rejected here,
    // so every tool reports the same UNAUTHORIZED through `requireMcpUser` and
    // the failure mode is identical whichever tool was called first.
    const identity = await getApiKeyUser(event)
    if (identity) {
      event.context.user = identity.user
      event.context.userId = identity.user.id
      event.context.apiKeyPermissions = identity.permissions ?? null
    }
  }
})
