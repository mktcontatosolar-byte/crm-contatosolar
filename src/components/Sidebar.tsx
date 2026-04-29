import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  Archive,
  ChevronRight,
  Crown,
  FolderKanban,
  History,
  Kanban,
  LayoutDashboard,
  LogOut,
  Medal,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from "lucide-react"

import GlobalLeadSearch from "@/components/GlobalLeadSearch"
import ThemeToggle from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuth } from "@/contexts/useAuth"
import { canViewCompetition, canViewDashboard, canViewProjects, ROLE_LABEL } from "@/lib/permissions"

type SidebarMenuItem = {
  label: string
  icon: typeof Users
  path: string
}

function SidebarNav({
  mobile = false,
  collapsed = false,
  menuItems,
  currentPath,
  onNavigate,
  onSignOut,
  profileName,
  profileRole,
  isAdmin,
}: {
  mobile?: boolean
  collapsed?: boolean
  menuItems: SidebarMenuItem[]
  currentPath: string
  onNavigate: (path: string) => void
  onSignOut: () => void
  profileName: string
  profileRole: string
  isAdmin: boolean
}) {
  return (
    <>
      <nav
        aria-label="Navegação principal"
        className={`flex-1 overflow-x-auto p-4 sm:p-5 lg:min-h-0 lg:overflow-y-auto lg:overflow-x-hidden ${
          mobile ? "overflow-visible p-0" : ""
        }`}
      >
        <div className={`flex gap-2 pb-1 lg:flex-col lg:pb-4 ${mobile ? "flex-col pb-0" : ""}`}>
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPath === item.path

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                aria-current={isActive ? "page" : undefined}
                title={collapsed && !mobile ? item.label : undefined}
                className={`flex min-h-12 shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-all focus-visible:border-sidebar-ring focus-visible:ring-3 focus-visible:ring-sidebar-ring/30 lg:w-full ${
                  isActive
                    ? "border-[color:color-mix(in_oklab,var(--sidebar-primary)_22%,transparent)] bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_12px_28px_color-mix(in_oklab,var(--sidebar-primary)_18%,transparent)]"
                    : "border-transparent bg-transparent text-sidebar-foreground/80 hover:border-sidebar-border/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                } ${collapsed && !mobile ? "justify-center px-0" : ""}`}
              >
                <Icon className="h-4 w-4" />
                {!collapsed || mobile ? <span className="font-medium">{item.label}</span> : null}
                {!collapsed || mobile ? (
                  <ChevronRight className="ml-auto hidden h-4 w-4 opacity-60 lg:block" />
                ) : null}
              </button>
            )
          })}
        </div>
      </nav>

      <div
        className={`${mobile ? "mt-5 border-t border-sidebar-border/70 pt-5" : "border-t border-sidebar-border/70 p-4 sm:p-5 lg:mt-auto"}`}
      >
        {!collapsed || mobile ? (
          <div className="mb-4 rounded-[1.5rem] border border-sidebar-border/70 bg-sidebar-accent/88 p-4">
            <p className="truncate text-sm font-medium">{profileName}</p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs capitalize text-sidebar-foreground/65">{profileRole}</p>
              <span className="rounded-full border border-[color:color-mix(in_oklab,var(--sidebar-ring)_18%,transparent)] bg-sidebar px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-sidebar-foreground/72">
                {ROLE_LABEL[profileRole as keyof typeof ROLE_LABEL] || (isAdmin ? "Admin" : "Vendedor")}
              </span>
            </div>
          </div>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          title={collapsed && !mobile ? "Sair" : undefined}
          className={`h-12 rounded-[1.25rem] text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
            collapsed && !mobile ? "w-full justify-center px-0" : "w-full justify-start"
          }`}
          onClick={onSignOut}
        >
          <LogOut className={`h-4 w-4 ${collapsed && !mobile ? "" : "mr-2"}`} />
          {!collapsed || mobile ? "Sair" : null}
        </Button>

        {!collapsed || mobile ? (
          <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/45">
            Desenvolvido por Gabriel B.
          </p>
        ) : null}
      </div>
    </>
  )
}

export default function Sidebar() {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isDashboardGeneralRoute = location.pathname === "/dashboard-geral"
  const [dashboardSidebarExpanded, setDashboardSidebarExpanded] = useState(false)
  const collapsed = isDashboardGeneralRoute ? !dashboardSidebarExpanded : false

  const menuItems = [
    ...(isAdmin
      ? [
          {
            label: "Leads sem responsável",
            icon: Users,
            path: "/",
          },
        ]
      : []),
    {
      label: "Meu Kanban",
      icon: Kanban,
      path: "/kanban",
    },
    ...(canViewProjects(profile?.role)
      ? [
          {
            label: "Projetos",
            icon: FolderKanban,
            path: "/projetos",
          },
        ]
      : []),
    ...(canViewCompetition(profile?.role)
      ? [
          {
            label: "Competição",
            icon: Medal,
            path: "/competicao",
          },
        ]
      : []),
    ...(canViewDashboard(profile?.role)
      ? [
          {
            label: "Dashboard Geral",
            icon: Crown,
            path: "/dashboard-geral",
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            label: "Equipe",
            icon: Users,
            path: "/equipe",
          },
          {
            label: "Arquivados",
            icon: Archive,
            path: "/arquivados",
          },
          {
            label: "Métricas",
            icon: LayoutDashboard,
            path: "/metricas",
          },
          {
            label: "Logs",
            icon: History,
            path: "/logs",
          },
        ]
      : []),
  ]

  async function handleSignOut() {
    await signOut()
    navigate("/login")
  }

  function handleNavigate(path: string) {
    if (path === "/dashboard-geral") {
      setDashboardSidebarExpanded(false)
    }

    navigate(path)
  }

  return (
    <aside
      className={`sticky top-0 z-30 border-b border-sidebar-border/70 bg-sidebar/92 text-sidebar-foreground backdrop-blur supports-[backdrop-filter]:bg-sidebar/86 lg:h-screen lg:border-r lg:border-b-0 lg:shrink-0 ${
        collapsed ? "lg:w-24" : "lg:w-80"
      }`}
    >
      <div className="flex h-full flex-col lg:min-h-0">
        <div className="border-b border-sidebar-border/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center">
                <div
                  className={`flex shrink-0 items-center overflow-hidden ${collapsed ? "h-12 w-12 justify-center" : "h-16 w-36 justify-start sm:h-20 sm:w-44"}`}
                >
                  <img
                    src="/logo-dark.png"
                    alt="Logo Contato Solar"
                    className={`h-full object-contain dark:hidden ${collapsed ? "w-12 object-center" : "w-full object-left"}`}
                  />
                  <img
                    src="/logo-light.png"
                    alt="Logo Contato Solar"
                    className={`hidden h-full object-contain dark:block ${collapsed ? "w-12 object-center" : "w-full object-left"}`}
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden lg:block">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full border-sidebar-border/70 bg-sidebar-accent text-sidebar-foreground"
                    onClick={() => setDashboardSidebarExpanded((current) => !current)}
                    aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
                    title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
                  >
                    {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </Button>
                </div>

                <ThemeToggle />

                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="rounded-full border-sidebar-border/70 bg-sidebar-accent text-sidebar-foreground lg:hidden"
                      aria-label="Abrir menu"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="border-sidebar-border/70 bg-sidebar text-sidebar-foreground"
                  >
                    <SheetHeader className="pr-10">
                      <SheetTitle className="text-sidebar-foreground">Menu</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 flex h-full flex-col">
                      <div className="mb-4">
                        <div className="rounded-[1.25rem] border border-sidebar-border/70 bg-sidebar-accent/80 p-2">
                          <GlobalLeadSearch variant="sidebar" />
                        </div>
                      </div>
                      <SidebarNav
                        mobile
                        menuItems={menuItems}
                        currentPath={location.pathname}
                        onNavigate={handleNavigate}
                        onSignOut={handleSignOut}
                        profileName={profile?.nome || profile?.email || "Usuário"}
                        profileRole={profile?.role || "sem perfil"}
                        isAdmin={isAdmin}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {!collapsed ? (
              <div className="hidden lg:block">
                <div className="rounded-[1.5rem] border border-sidebar-border/70 bg-sidebar-accent/65 p-1.5">
                  <GlobalLeadSearch variant="sidebar-full" />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden lg:flex lg:h-full lg:min-h-0 lg:flex-col">
          <SidebarNav
            collapsed={collapsed}
            menuItems={menuItems}
            currentPath={location.pathname}
            onNavigate={handleNavigate}
            onSignOut={handleSignOut}
            profileName={profile?.nome || profile?.email || "Usuário"}
            profileRole={profile?.role || "sem perfil"}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </aside>
  )
}


