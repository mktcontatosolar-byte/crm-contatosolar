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
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
}

export default function StatePanel({
  children,
  tone = "default",
  dashed = false,
  centered = true,
}: StatePanelProps) {
  return (
    <div
      className={`rounded-[1.5rem] border px-4 py-4 text-sm ${toneClasses[tone]} ${
        dashed ? "border-dashed" : ""
      } ${centered ? "text-center" : ""} backdrop-blur`}
    >
      {children}
    </div>
  )
}
