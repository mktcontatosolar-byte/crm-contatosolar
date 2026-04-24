import Sidebar from "@/components/Sidebar"
import { useLocation } from "react-router-dom"

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isKanbanRoute = location.pathname === "/kanban"

  return (
    <div className="relative flex min-h-screen flex-col bg-background lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar />

      <main
        className={[
          "relative flex-1 overflow-visible lg:h-screen",
          isKanbanRoute ? "overflow-hidden lg:overflow-hidden" : "lg:overflow-y-auto",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto w-full max-w-[1760px] p-4 pb-8 sm:p-6 sm:pb-10 lg:p-8 lg:pb-12",
            isKanbanRoute ? "h-full overflow-hidden" : "",
          ].join(" ")}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
