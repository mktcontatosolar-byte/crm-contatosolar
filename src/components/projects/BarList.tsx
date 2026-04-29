type BarListItem = {
  label: string
  valueLabel: string
  progress: number
  accentClassName?: string
  onClick?: () => void
  active?: boolean
}

export default function BarList({
  items,
  emptyText,
}: {
  items: BarListItem[]
  emptyText: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={`${item.label}-${item.valueLabel}`} className="space-y-2">
          <div
            role={item.onClick ? "button" : undefined}
            tabIndex={item.onClick ? 0 : undefined}
            onClick={item.onClick}
            onKeyDown={
              item.onClick
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      item.onClick?.()
                    }
                  }
                : undefined
            }
            className={`rounded-2xl px-3 py-2 transition ${
              item.onClick
                ? item.active
                  ? "cursor-pointer bg-primary/[0.08] outline-none ring-1 ring-primary/20"
                  : "cursor-pointer hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
                : ""
            }`}
          >
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="truncate text-foreground">{item.label}</span>
              <span className="shrink-0 font-medium text-muted-foreground">{item.valueLabel}</span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-muted/60">
              <div
                className={`h-3 rounded-full bg-[linear-gradient(90deg,var(--color-chart-2),var(--color-chart-1))] ${item.accentClassName ?? ""}`}
                style={{ width: `${Math.max(6, Math.min(item.progress, 100))}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
