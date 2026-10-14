import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

interface AuthValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  profileError: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

type ProfileLoadResult = {
  profile: Profile | null
  error: string | null
}

const AuthContext = createContext<AuthValue | null>(null)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const PROFILE_ATTEMPT_TIMEOUT_MS = 3000

const errorMessage = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback

async function fetchProfile(userId: string): Promise<ProfileLoadResult> {
  let lastMessage = 'Your StockPilot workspace profile could not be loaded.'

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const profileRequest = supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Workspace profile request timed out.')), PROFILE_ATTEMPT_TIMEOUT_MS)
      })
      const { data, error } = await Promise.race([profileRequest, timeout])
      if (!error && data) return { profile: data as Profile, error: null }
      lastMessage = error?.message || 'Your account is authenticated but no workspace profile was found.'
    } catch (error) {
      lastMessage = errorMessage(error, 'Your StockPilot workspace profile could not be loaded.')
    } finally {
      if (timer) clearTimeout(timer)
    }

    if (attempt < 2) await wait(250 * (attempt + 1))
  }

  return { profile: null, error: lastMessage }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const sessionRef = useRef<Session | null>(null)
  const profileRef = useRef<Profile | null>(null)
  const syncSequence = useRef(0)
  const mountedRef = useRef(true)
  const explicitSignInRef = useRef(false)

  const applySession = async (
    next: Session | null,
    options: { showLoading?: boolean; reloadProfile?: boolean } = {},
  ): Promise<ProfileLoadResult> => {
    const syncId = ++syncSequence.current
    const showLoading = options.showLoading ?? true
    const reloadProfile = options.reloadProfile ?? true

    if (showLoading) setLoading(true)
    sessionRef.current = next
    setSession(next)

    if (!next) {
      profileRef.current = null
      setProfile(null)
      setProfileError(null)
      if (mountedRef.current && syncId === syncSequence.current) setLoading(false)
      return { profile: null, error: null }
    }

    if (!reloadProfile && profileRef.current?.id === next.user.id) {
      if (mountedRef.current && syncId === syncSequence.current) setLoading(false)
      return { profile: profileRef.current, error: null }
    }

    const result = await fetchProfile(next.user.id)
    if (!mountedRef.current || syncId !== syncSequence.current) return result

    profileRef.current = result.profile
    setProfile(result.profile)
    setProfileError(result.error)
    setLoading(false)
    return result
  }

  useEffect(() => {
    mountedRef.current = true
    let active = true
    let bootstrapSuperseded = false

    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, next) => {
      bootstrapSuperseded = true
      window.setTimeout(() => {
        if (!active) return

        if (event === 'SIGNED_OUT' || !next) {
          void applySession(null)
          return
        }

        // A password sign-in is completed directly from signInWithPassword's returned
        // session. During that operation, auth notifications only keep the token copy
        // current; they must not compete with the explicit profile/session handoff.
        if (explicitSignInRef.current) {
          sessionRef.current = next
          setSession(next)
          return
        }

        const sameUser = sessionRef.current?.user.id === next.user.id
        const hasCurrentProfile = profileRef.current?.id === next.user.id

        if (
          sameUser &&
          hasCurrentProfile &&
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')
        ) {
          sessionRef.current = next
          setSession(next)
          return
        }

        void applySession(next, {
          showLoading: !(sameUser && hasCurrentProfile),
          reloadProfile: !hasCurrentProfile,
        })
      }, 0)
    })

    // Restore a persisted browser/device session. If Supabase emits an auth event
    // first, that newer event owns bootstrap and this snapshot is ignored.
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || bootstrapSuperseded) return
      if (error) {
        sessionRef.current = null
        profileRef.current = null
        setSession(null)
        setProfile(null)
        setProfileError(error.message)
        setLoading(false)
        return
      }
      void applySession(data.session)
    }).catch(error => {
      if (!active || bootstrapSuperseded) return
      sessionRef.current = null
      profileRef.current = null
      setSession(null)
      setProfile(null)
      setProfileError(errorMessage(error, 'Stored session could not be checked.'))
      setLoading(false)
    })

    return () => {
      active = false
      mountedRef.current = false
      ++syncSequence.current
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    explicitSignInRef.current = true
    setLoading(true)
    setProfileError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!data.session) throw new Error('Sign-in succeeded but no StockPilot session was returned.')

      // Do not wait for onAuthStateChange to navigate the application. The session
      // returned by the successful password exchange is authoritative for this login.
      await applySession(data.session, { showLoading: false, reloadProfile: true })
    } catch (error) {
      if (!sessionRef.current) setLoading(false)
      throw error
    } finally {
      explicitSignInRef.current = false
      if (mountedRef.current) setLoading(false)
    }
  }

  const refreshProfile = async () => {
    const current = sessionRef.current
    if (!current) {
      profileRef.current = null
      setProfile(null)
      setProfileError(null)
      setLoading(false)
      return
    }
    await applySession(current, { showLoading: true, reloadProfile: true })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    await applySession(null)
  }

  return <AuthContext.Provider value={{
    session,
    user: session?.user || null,
    profile,
    profileError,
    loading,
    signIn,
    signOut,
    refreshProfile,
  }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be inside AuthProvider')
  return value
}
