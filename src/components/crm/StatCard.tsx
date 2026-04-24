import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type StatCardProps = {
  label: string
  value: number
  icon: LucideIcon
  accentClassName: string
  helperText?: string
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  accentClassName,
  helperText,
}: StatCardProps) {
  return (
    <Card className="border border-border/60 bg-card/92 shadow-sm">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-4">
          <CardDescription className="text-sm uppercase tracking-[0.14em]">{label}</CardDescription>
          <div className="rounded-2xl border border-border/60 bg-background/80 p-2 shadow-sm">
            <Icon className={`h-4 w-4 ${accentClassName}`} />
          </div>
        </div>
        <CardTitle className="text-4xl font-semibold tracking-tight">{value}</CardTitle>
      </CardHeader>
      {helperText ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </CardContent>
      ) : null}
      <div className="mx-6 mt-auto h-1 rounded-full bg-[linear-gradient(90deg,var(--color-chart-2),var(--color-chart-1),transparent)]" />
    </Card>
  )
}
