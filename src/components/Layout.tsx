import Sidebar from "@/components/Sidebar"
import GlobalLeadSearch from "@/components/GlobalLeadSearch"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar />

      <main className="relative flex-1 overflow-visible lg:h-screen lg:overflow-y-auto">
        <div className="sticky top-0 z-20 flex justify-end px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
          <div className="rounded-[1.5rem] border border-border/60 bg-background/85 p-1.5 shadow-sm backdrop-blur">
            <GlobalLeadSearch />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1760px] p-4 pb-8 sm:p-6 sm:pb-10 lg:p-8 lg:pb-12">
          {children}
        </div>
      </main>
    </div>
  )
}
