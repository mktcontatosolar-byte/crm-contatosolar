import Sidebar from "@/components/Sidebar"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar />

      <main className="relative flex-1 overflow-visible lg:h-screen lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-[1760px] p-4 pb-8 sm:p-6 sm:pb-10 lg:p-8 lg:pb-12">
          {children}
        </div>
      </main>
    </div>
  )
}
