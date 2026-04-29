import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import SectionCard from "@/components/crm/SectionCard"

type FilterBarProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export default function FilterBar({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: FilterBarProps) {
  return (
    <SectionCard
      title={title}
      description={description}
      actions={actions}
      className={cn("bg-background/68 shadow-none", className)}
      contentClassName={cn("space-y-4", contentClassName)}
      titleClassName="text-base"
    >
      {children}
    </SectionCard>
  )
}
