 
import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  Archive,
  Calculator,
  Crown,
  FolderKanban,
  History,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  SlidersHorizontal,
  Users,
} from "lucide-react"

import GlobalLeadSearch from "@/components/GlobalLeadSearch"
import ThemeToggle from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuth } from "@/contexts/useAuth"
import { canManageCalculadoraConfig, canViewCalculadora, canViewDashboard, canViewProjects } from "@/lib/permissions"

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
}: {
  mobile?: boolean
  collapsed?: boolean
  menuItems: SidebarMenuItem[]
  currentPath: string
  onNavigate: (path: string) => void
  onSignOut: () => void
  profileName: string
}) {
  return (
    <>
      <nav
        aria-label="Navegação principal"
        className={`flex-1 overflow-x-auto lg:min-h-0 lg:overflow-y-auto lg:overflow-x-hidden ${
          mobile ? "overflow-visible p-0" : "p-3"
        }`}
      >
        <div className={`flex flex-col gap-1 ${mobile ? "flex-col" : ""}`}>
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
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors lg:w-full ${
                  isActive
                    ? "bg-muted text-text-main font-semibold"
                    : "text-text-sec hover:bg-muted hover:text-text-main"
                } ${
                  collapsed && !mobile
                    ? "h-10 w-10 justify-center"
                    : "justify-start"
                }`}
              >
                <Icon
                  className="h-[18px] w-[18px] shrink-0"
                  strokeWidth={1.8}
                />
                {!collapsed || mobile ? <span>{item.label}</span> : null}
              </button>
            )
          })}
        </div>
      </nav>

      <div
        className={`${mobile ? "mt-auto border-t border-border p-2" : "mt-auto border-t border-border p-3"}`}
      >
        {!collapsed || mobile ? (
          <div className="flex items-center gap-3 p-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {profileName.charAt(0)}
            </div>
            <p className="truncate text-sm font-semibold text-text-main">
              {profileName}
            </p>
          </div>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          title={collapsed && !mobile ? "Sair" : undefined}
          className={`mt-1 h-auto w-full justify-start rounded-lg p-2.5 text-sm font-medium text-text-sec hover:bg-muted hover:text-text-main ${
            collapsed && !mobile ? "justify-center" : ""
          }`}
          onClick={onSignOut}
        >
          <LogOut
            className={`h-[18px] w-[18px] ${collapsed && !mobile ? "" : "mr-2"}`}
            strokeWidth={1.8}
          />
          {!collapsed || mobile ? "Sair" : null}
        </Button>
      </div>
    </>
  )
}

export default function Sidebar() {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const collapsed = false

  const menuItems: SidebarMenuItem[] = [
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
    ...(canViewDashboard(profile?.role)
      ? [
          {
            label: "Dashboard Geral",
            icon: Crown,
            path: "/dashboard-geral",
          },
        ]
      : []),
    ...(canViewCalculadora(profile?.role)
      ? [
          {
            label: "Calculadora",
            icon: Calculator,
            path: "/calculadora",
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
    ...(canManageCalculadoraConfig(profile?.role)
      ? [
          {
            label: "Config Calculadora",
            icon: SlidersHorizontal,
            path: "/calculadora-config",
          },
        ]
      : []),
  ]

  async function handleSignOut() {
    await signOut()
    navigate("/login")
  }

  function handleNavigate(path: string) {
    navigate(path)
    setIsMobileMenuOpen(false)
  }

  const profileName = profile?.nome || profile?.email || "Usuário"

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`sticky top-0 z-30 hidden border-r border-border bg-sidebar text-text-main lg:flex lg:h-screen lg:flex-col lg:shrink-0 ${
          collapsed ? "lg:w-[78px]" : "lg:w-[220px]"
        }`}
      >
        <div className="flex h-[72px] items-center justify-center border-b border-border px-4">
          <div
            className={`flex items-center gap-3 overflow-hidden ${
              collapsed ? "justify-center" : "justify-start"
            }`}
          >
            <img
              src="/logo-dark.png"
              alt="Logo Contato Solar"
              className={`object-contain dark:hidden ${collapsed ? "h-8" : "h-9"}`}
            />
            <img
              src="/logo-light.png"
              alt="Logo Contato Solar"
              className={`hidden object-contain dark:block ${collapsed ? "h-8" : "h-9"}`}
            />
          </div>
        </div>

        {!collapsed ? (
          <div className="p-3">
            <GlobalLeadSearch variant="sidebar-full" />
          </div>
        ) : null}

        <SidebarNav
          collapsed={collapsed}
          menuItems={menuItems}
          currentPath={location.pathname}
          onNavigate={handleNavigate}
          onSignOut={handleSignOut}
          profileName={profileName}
        />
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between border-b border-border bg-sidebar/80 px-4 text-text-main backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-lg"
                aria-label="Abrir menu"
              >
                <Menu className="h-[20px] w-[20px]" strokeWidth={1.8} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[240px] border-border bg-sidebar p-0 text-text-main"
            >
              <div className="flex h-[72px] items-center justify-center border-b border-border">
                <img
                  src="/logo-dark.png"
                  alt="Logo Contato Solar"
                  className="h-9 dark:hidden"
                />
                <img
                  src="/logo-light.png"
                  alt="Logo Contato Solar"
                  className="hidden h-9 dark:block"
                />
              </div>
              <div className="p-2">
                <GlobalLeadSearch variant="sidebar" />
              </div>
              <SidebarNav
                mobile
                menuItems={menuItems}
                currentPath={location.pathname}
                onNavigate={handleNavigate}
                onSignOut={handleSignOut}
                profileName={profileName}
              />
            </SheetContent>
          </Sheet>
          <img
            src="/logo-dark.png"
            alt="Logo Contato Solar"
            className="h-7 object-contain dark:hidden"
          />
          <img
            src="/logo-light.png"
            alt="Logo Contato Solar"
            className="hidden h-7 object-contain dark:block"
          />
        </div>

        <div className="flex items-center gap-2">
          <GlobalLeadSearch variant="sidebar" />
          <ThemeToggle />
        </div>
      </header>
    </>
  )
}
