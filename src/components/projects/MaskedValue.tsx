import { cn } from "@/lib/utils"

export default function MaskedValue({
  value,
  masked,
  placeholder = "Privado",
  blurOnly = false,
  className,
}: {
  value: string
  masked: boolean
  placeholder?: string
  blurOnly?: boolean
  className?: string
}) {
  if (!masked) {
    return <span className={className}>{value}</span>
  }

  if (!blurOnly) {
    return <span className={className}>{placeholder}</span>
  }

  return (
    <span
      aria-label={placeholder}
      className={cn("inline-block select-none blur-sm transition-all", className)}
    >
      {value}
    </span>
  )
}
