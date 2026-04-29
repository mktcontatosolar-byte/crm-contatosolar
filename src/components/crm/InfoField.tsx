import type { ComponentType, ReactNode } from "react"

import { cn } from "@/lib/utils"

type InfoFieldProps = {
  icon: ComponentType<{ className?: string }>
  label: string
  value: ReactNode
  tone?: "default" | "highlight"
  valueClassName?: string
  className?: string
}

export default function InfoField({
  icon: Icon,
  label,
  value,
  tone = "default",
  valueClassName,
  className,
}: InfoFieldProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-background/70 p-4",
        tone === "highlight" &&
          "shadow-sm ring-1 ring-[color:color-mix(in_oklab,var(--accent)_14%,transparent)]",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-border/60 bg-card/90 p-2">
          <Icon className={cn("h-4 w-4", tone === "highlight" ? "text-accent" : "text-primary")} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <div
            className={cn(
              "mt-1 break-words text-sm text-muted-foreground",
              tone === "highlight" && "text-base font-semibold text-foreground",
              valueClassName
            )}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  )
}
