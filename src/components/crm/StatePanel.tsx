import type { ReactNode } from "react"

type StatePanelProps = {
  children: ReactNode
  tone?: "default" | "error" | "warning"
  dashed?: boolean
  centered?: boolean
}

const toneClasses = {
  default: "border-border/60 bg-card/92 text-muted-foreground shadow-sm",
  error: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
  warning: "border-[color:color-mix(in_oklab,var(--accent)_28%,transparent)] bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)] text-foreground",
}

export default function StatePanel({
  children,
  tone = "default",
  dashed = false,
  centered = true,
}: StatePanelProps) {
  return (
    <div
      className={`rounded-3xl border px-4 py-4 text-sm ${toneClasses[tone]} ${
        dashed ? "border-dashed" : ""
      } ${centered ? "text-center" : ""} backdrop-blur`}
    >
      {children}
    </div>
  )
}
