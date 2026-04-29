import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type SectionCardProps = {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  headerClassName?: string
  titleClassName?: string
  descriptionClassName?: string
  tone?: "default" | "highlight"
}

export default function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  headerClassName,
  titleClassName,
  descriptionClassName,
  tone = "default",
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        "rounded-3xl border border-border/60 bg-card/92 shadow-sm",
        tone === "highlight" &&
          "border-[color:color-mix(in_oklab,var(--accent)_22%,transparent)] shadow-[0_12px_32px_color-mix(in_oklab,var(--accent)_10%,transparent)]",
        className
      )}
    >
      {title || description || actions ? (
        <CardHeader
          className={cn(
            "gap-3",
            actions && "flex flex-col lg:flex-row lg:items-start lg:justify-between",
            headerClassName
          )}
        >
          <div className="space-y-1.5">
            {title ? <CardTitle className={cn("text-lg", titleClassName)}>{title}</CardTitle> : null}
            {description ? (
              <CardDescription className={descriptionClassName}>{description}</CardDescription>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
    </Card>
  )
}
