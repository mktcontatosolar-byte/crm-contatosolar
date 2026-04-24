import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import Layout from "@/components/Layout"
import { useAuth } from "@/contexts/useAuth"
import Login from "@/pages/Login"

const KanbanPage = lazy(() => import("@/pages/KanbanPage"))
const ArchivedLeadsPage = lazy(() => import("@/pages/ArchivedLeadsPage"))
const LeadDetailPage = lazy(() => import("@/pages/LeadDetailPage"))
const MetricsPage = lazy(() => import("@/pages/MetricsPage"))
const PoolLeadsPage = lazy(() => import("@/pages/PoolLeadsPage"))
const TeamPage = lazy(() => import("@/pages/TeamPage"))

function RouteFallback() {
  return (
    <div className="rounded-[2rem] border border-border/60 bg-card/90 px-6 py-10 text-center text-sm text-muted-foreground shadow-sm backdrop-blur">
      Carregando módulo...
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm rounded-[2rem] border border-border/60 bg-card/90 px-6 py-10 text-center shadow-sm backdrop-blur">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-primary/10" />
          <p className="text-sm text-muted-foreground">Carregando sua sessão...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Layout>{children}</Layout>
}

export default function App() {
  const { user, loading, isAdmin, profile } = useAuth()
  const homePath = isAdmin ? "/" : "/kanban"

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm rounded-[2rem] border border-border/60 bg-card/90 px-6 py-10 text-center shadow-sm backdrop-blur">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-primary/10" />
          <p className="text-sm text-muted-foreground">Preparando o CRM...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homePath} replace /> : <Login />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Suspense fallback={<RouteFallback />}>
              {profile?.role === "admin" ? <PoolLeadsPage /> : <Navigate to="/kanban" replace />}
            </Suspense>
          </PrivateRoute>
        }
      />

      <Route
        path="/kanban"
        element={
          <PrivateRoute>
            <Suspense fallback={<RouteFallback />}>
              <KanbanPage />
            </Suspense>
          </PrivateRoute>
        }
      />

      <Route
        path="/arquivados"
        element={
          <PrivateRoute>
            <Suspense fallback={<RouteFallback />}>
              {profile?.role === "admin" ? <ArchivedLeadsPage /> : <Navigate to="/kanban" replace />}
            </Suspense>
          </PrivateRoute>
        }
      />

      <Route
        path="/leads/:id"
        element={
          <PrivateRoute>
            <Suspense fallback={<RouteFallback />}>
              <LeadDetailPage />
            </Suspense>
          </PrivateRoute>
        }
      />

      <Route
        path="/metricas"
        element={
          <PrivateRoute>
            <Suspense fallback={<RouteFallback />}>
              <MetricsPage />
            </Suspense>
          </PrivateRoute>
        }
      />

      <Route
        path="/equipe"
        element={
          <PrivateRoute>
            <Suspense fallback={<RouteFallback />}>
              <TeamPage />
            </Suspense>
          </PrivateRoute>
        }
      />

      <Route path="*" element={<Navigate to={homePath} replace />} />
    </Routes>
  )
}
