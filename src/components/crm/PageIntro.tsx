import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"

type PageIntroProps = {
  badge: string
  title: string
  description: string
  badgeTone?: "sky" | "emerald" | "amber" | "cyan"
  aside?: ReactNode
}

const badgeToneClasses = {
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
}

export default function PageIntro({
  badge,
  title,
  description,
  badgeTone = "sky",
  aside,
}: PageIntroProps) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card/92 p-6 shadow-sm backdrop-blur sm:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <Badge
            variant="outline"
            className={`h-6 rounded-full px-3 text-xs font-medium ${badgeToneClasses[badgeTone]}`}
          >
            {badge}
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>
        </div>

        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </section>
  )
}
