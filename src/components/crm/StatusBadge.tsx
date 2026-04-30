import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type StatusBadgeProps = {
  children: ReactNode
  tone?: "primary" | "accent" | "muted" | "outline"
  className?: string
}

const toneClasses = {
  primary: "crm-badge-brand",
  accent: "crm-badge-highlight",
  muted: "border-border/60 bg-background/70 text-foreground/90 dark:text-foreground",
  outline: "",
}

export default function StatusBadge({
  children,
  tone = "primary",
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      variant={tone === "outline" ? "outline" : undefined}
      className={cn("min-h-7 rounded-full px-3 text-xs font-medium", toneClasses[tone], className)}
    >
      {children}
    </Badge>
  )
}
