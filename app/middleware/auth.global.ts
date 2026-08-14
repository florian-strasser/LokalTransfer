// Route guard.
//
// The rules, in order of who they protect:
//
//   * Public routes (sign-in, password recovery, magic-link landing, download
//     pages) are open. A download link in particular must work for someone with
//     no account at all — that is the whole point of it.
//   * Everything else needs a session.
//   * Guests are confined to the upload page. Their session is a real session, so
//     without this they could reach the dashboard and other people's transfer
//     lists. The server enforces this too; this is what keeps them from seeing a
//     broken page they were never meant to open.
//   * Admin-only routes are checked here for the same reason.

const PUBLIC_ROUTES = ['/', '/lost-password']
const PUBLIC_PREFIXES = ['/reset-password/', '/magic/', '/d/']

function isPublic(path: string): boolean {
  if (PUBLIC_ROUTES.includes(path)) return true
  return PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix))
}

const ADMIN_PREFIXES = ['/users']
// The one place a guest is allowed.
const GUEST_ROUTES = ['/send']

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchSession, isAdmin, isGuest } = useAuth()

  // Fetched once and cached in shared state, so this doesn't cost a request per
  // navigation.
  await fetchSession()

  if (!user.value) {
    if (isPublic(to.path)) return
    // `redirect` brings them back to where they were headed after signing in.
    return navigateTo({ path: '/', query: to.path === '/' ? {} : { redirect: to.path } })
  }

  // Signed in, but on the sign-in page: send them where they belong instead of
  // showing a login form to someone who is already logged in.
  if (to.path === '/') {
    return navigateTo(isGuest.value ? '/send' : '/dashboard')
  }

  if (isGuest.value) {
    // Download pages stay reachable — a guest may well also be a recipient.
    if (to.path.startsWith('/d/')) return
    if (!GUEST_ROUTES.includes(to.path)) return navigateTo('/send')
    return
  }

  // A member landing on the guest upload page has their own composer instead.
  if (to.path === '/send') return navigateTo('/transfers/new')

  if (ADMIN_PREFIXES.some(prefix => to.path.startsWith(prefix)) && !isAdmin.value) {
    return navigateTo('/dashboard')
  }
})
