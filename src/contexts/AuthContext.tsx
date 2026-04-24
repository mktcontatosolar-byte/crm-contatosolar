import {
  createContext,
  type ReactNode,
  startTransition,
  useEffect,
  useState,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { Profile } from "@/types"

type AuthErrorResult = {
  error: Error | null
}

type AuthContextType = {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<AuthErrorResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function withTimeout<T>(promise: PromiseLike<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("Timeout na requisição")), ms)
    }),
  ])
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function getProfile(user: User): Promise<Profile | null> {
  try {
    for (const delay of [0, 400]) {
      if (delay > 0) {
        await wait(delay)
      }

      const { data: existingProfile, error: selectError } = await withTimeout(
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      )

      if (selectError) {
        throw selectError
      }

      if (existingProfile) {
        return existingProfile as Profile
      }
    }
  } catch (error) {
    console.error("Erro ao carregar profile:", error)
  }

  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.role === "admin"

  async function syncAuthState(currentSession: Session | null) {
    if (!currentSession?.user) {
      startTransition(() => {
        setSession(null)
        setUser(null)
        setProfile(null)
        setLoading(false)
      })
      return
    }

    const nextProfile = await getProfile(currentSession.user)

    startTransition(() => {
      setSession(currentSession)
      setUser(currentSession.user)
      setProfile(nextProfile)
      setLoading(false)
    })
  }

  async function refreshProfile() {
    if (!user) {
      return
    }

    const nextProfile = await getProfile(user)
    startTransition(() => {
      setProfile(nextProfile)
    })
  }

  async function signIn(email: string, password: string): Promise<AuthErrorResult> {
    try {
      startTransition(() => {
        setLoading(true)
      })

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        })
      )

      if (error) {
        startTransition(() => {
          setLoading(false)
        })
        return { error }
      }

      await syncAuthState(data.session)
      return { error: null }
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error("Erro inesperado ao fazer login")

      console.error("Erro inesperado no login:", normalizedError)
      startTransition(() => {
        setLoading(false)
      })
      return { error: normalizedError }
    }
  }

  async function signOut() {
    try {
      startTransition(() => {
        setLoading(true)
      })

      await supabase.auth.signOut()
      await syncAuthState(null)
    } catch (error) {
      console.error("Erro ao sair:", error)
      startTransition(() => {
        setLoading(false)
      })
    }
  }

  useEffect(() => {
    let active = true

    const initializeAuth = async () => {
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession())

        if (!active) {
          return
        }

        if (error) {
          console.error("Erro ao buscar sessão:", error)
          await syncAuthState(null)
          return
        }

        await syncAuthState(data.session)
      } catch (error) {
        if (!active) {
          return
        }

        console.error("Erro ao carregar sessão inicial:", error)
        await syncAuthState(null)
      }
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!active) {
        return
      }

      startTransition(() => {
        setLoading(true)
      })

      void syncAuthState(currentSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAdmin,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
