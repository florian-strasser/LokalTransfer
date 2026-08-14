import bcrypt from 'bcryptjs'
import { resolveDownload, setUnlockCookie } from '../../../utils/download'
import { downloadLimiter, enforceRateLimit } from '../../../utils/rateLimit'
import { logger } from '../../../utils/logger'

// Exchange a transfer's password for an unlock cookie.
//
// The share password is deliberately allowed to be short — it gets read off a
// text message — so this endpoint is what keeps it meaningful. Every attempt
// counts against the download limiter, which caps online guessing to a rate no
// attacker can work with, and bcrypt makes each attempt expensive regardless.
export default defineEventHandler(async (event) => {
  if (!enforceRateLimit(event, downloadLimiter)) {
    return { error: 'TOO_MANY_REQUESTS' }
  }

  try {
    const resolution = await resolveDownload(getRouterParam(event, 'token'))
    if (!resolution.ok) {
      setResponseStatus(event, resolution.status)
      return { error: resolution.error }
    }

    const { transfer } = resolution

    // Nothing to unlock. Answering success keeps the client's flow simple and
    // reveals nothing — the page already knows whether a password is required.
    if (!transfer.passwordHash) return { success: true }

    const body = await readBody(event)
    const password = body?.password

    if (typeof password !== 'string' || password.length === 0) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_PASSWORD' }
    }

    if (!(await bcrypt.compare(password, String(transfer.passwordHash)))) {
      setResponseStatus(event, 403)
      return { error: 'INVALID_PASSWORD' }
    }

    setUnlockCookie(event, transfer)

    return { success: true }
  } catch (error) {
    logger.error('Transfer unlock error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
