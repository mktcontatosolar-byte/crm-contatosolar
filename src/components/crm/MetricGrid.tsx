import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export default function MetricGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)}>{children}</section>
}
