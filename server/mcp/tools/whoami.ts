import { isReadOnlyKey, requireMcpUser } from '../../utils/mcpHelpers'

export default defineMcpTool({
  name: 'whoami',
  title: 'Who am I',
  description:
    'Return the account this API key acts as: userId, name, email, role, and whether the key is read-only. '
    + 'Call this first to confirm your identity and what you are allowed to do.',
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async () => {
    const user = requireMcpUser()

    return jsonResult({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      readOnlyKey: isReadOnlyKey()
    })
  }
})
