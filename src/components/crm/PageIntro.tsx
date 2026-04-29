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
  sky: "crm-badge-brand",
  emerald: "crm-badge-brand",
  amber: "crm-badge-highlight",
  cyan: "crm-badge-brand",
}

export default function PageIntro({
  badge,
  title,
  description,
  badgeTone = "sky",
  aside,
}: PageIntroProps) {
  return (
    <section className="crm-surface-panel overflow-hidden rounded-[2rem] p-6 sm:p-8">
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
