import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import ThemeToggle from "@/components/ThemeToggle"
import { useAuth } from "@/contexts/useAuth"
import {
  Archive,
  Building2,
  ChevronRight,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
} from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

type SidebarMenuItem = {
  label: string
  icon: typeof Users
  path: string
}

function SidebarNav({
  mobile = false,
  menuItems,
  currentPath,
  onNavigate,
  onSignOut,
  profileName,
  profileRole,
  isAdmin,
}: {
  mobile?: boolean
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
                className={`flex min-h-12 shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-all focus-visible:border-sidebar-ring focus-visible:ring-3 focus-visible:ring-sidebar-ring/30 lg:w-full ${
                  isActive
                    ? "border-sidebar-primary/20 bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "border-transparent bg-transparent text-sidebar-foreground/80 hover:border-sidebar-border/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{item.label}</span>
                <ChevronRight className="ml-auto hidden h-4 w-4 opacity-60 lg:block" />
              </button>
            )
          })}
        </div>
      </nav>

      <div className={`${mobile ? "mt-5 border-t border-sidebar-border/70 pt-5" : "border-t border-sidebar-border/70 p-4 sm:p-5 lg:mt-auto"}`}>
        <div className="mb-4 rounded-[1.5rem] border border-sidebar-border/70 bg-sidebar-accent/80 p-4">
          <p className="truncate text-sm font-medium">{profileName}</p>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs capitalize text-sidebar-foreground/65">{profileRole}</p>
            <span className="rounded-full border border-sidebar-border/70 bg-sidebar px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-sidebar-foreground/70">
              {isAdmin ? "Admin" : "Corretor"}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-12 w-full justify-start rounded-[1.25rem] text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={onSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/45">
          feito por Gabriel S.
        </p>
      </div>
    </>
  )
}

export default function Sidebar() {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    ...(isAdmin
      ? [
          {
            label: "Pool de Leads",
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
        ]
      : []),
  ]

  async function handleSignOut() {
    await signOut()
    navigate("/login")
  }

  return (
    <aside className="sticky top-0 z-30 border-b border-sidebar-border/70 bg-sidebar/90 text-sidebar-foreground backdrop-blur supports-[backdrop-filter]:bg-sidebar/80 lg:h-screen lg:w-80 lg:border-r lg:border-b-0 lg:shrink-0">
      <div className="flex h-full flex-col lg:min-h-0">
        <div className="border-b border-sidebar-border/70 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-primary/20 p-2.5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--sidebar-primary)_12%,transparent)]">
                <Building2 className="h-5 w-5 text-sidebar-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">CRM Lançamento</p>
                <p className="text-sm text-sidebar-foreground/70">Operação comercial em azul escuro e laranja</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
                    <SidebarNav
                      mobile
                      menuItems={menuItems}
                      currentPath={location.pathname}
                      onNavigate={navigate}
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
        </div>

        <div className="hidden lg:flex lg:h-full lg:min-h-0 lg:flex-col">
          <SidebarNav
            menuItems={menuItems}
            currentPath={location.pathname}
            onNavigate={navigate}
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
