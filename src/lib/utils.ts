import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSupabaseValue(value: unknown) {
  if (value === null || value === undefined) {
    return "Vazio"
  }

  if (typeof value === "string") {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : "Vazio"
  }

  return String(value)
}

export function formatSupabaseBoolean(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "Vazio"
  }

  return value ? "Sim" : "Não"
}

