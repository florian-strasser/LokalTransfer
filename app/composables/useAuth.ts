export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  type: 'member' | 'guest'
  company: string | null
}

/**
 * The signed-in user, shared across the app.
 *
 * Held in `useState` so the session is fetched once during SSR and handed to the
 * client in the payload — rather than every page and the route middleware each
 * making their own `/api/auth/get-session` call.
 */
export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)

  /**
   * Load the session from the server.
   *
   * `force` skips the cached value, which matters after signing in or out: the
   * state is stale by definition at that moment.
   */
  async function fetchSession(force = false): Promise<AuthUser | null> {
    if (user.value && !force) return user.value

    // `useRequestFetch` rather than plain `$fetch`: during SSR the server has no
    // browser to inherit cookies from, so a bare $fetch would call the session
    // endpoint unauthenticated and every direct page load — a refresh, a pasted
    // URL, following a link from an e-mail — would bounce a signed-in user back
    // to the login screen. This forwards the incoming request's cookies.
    const request = useRequestFetch()

    try {
      const response = await request<{ data: { user: AuthUser } }>('/api/auth/get-session')
      user.value = response?.data?.user ?? null
    } catch {
      // A 401 here is the normal "not signed in" case, not an error worth
      // surfacing anywhere.
      user.value = null
    }

    return user.value
  }

  async function signOut() {
    try {
      await $fetch('/api/auth/sign-out', { method: 'POST' })
    } finally {
      // Cleared even if the request failed — the cookie is gone either way, and
      // leaving a stale user in state would show a signed-in UI that 401s on
      // every action.
      user.value = null
      await navigateTo('/')
    }
  }

  const isAdmin = computed(() => user.value?.role === 'admin' && user.value?.type === 'member')
  const isGuest = computed(() => user.value?.type === 'guest')
  const isMember = computed(() => user.value?.type === 'member')

  return { user, fetchSession, signOut, isAdmin, isGuest, isMember }
}
