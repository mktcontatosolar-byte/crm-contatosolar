import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function ResponsiveTableWrapper({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>
}

export function TableCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border/60 bg-card/84 shadow-sm", className)}>
      {children}
    </div>
  )
}
