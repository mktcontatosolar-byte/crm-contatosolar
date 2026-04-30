export const CRM_TIME_ZONE = "America/Sao_Paulo"
export const CRM_LOCALE = "pt-BR"

const DEFAULT_FALLBACK = "—"
const HAS_TIMEZONE_PATTERN = /(Z|[+-]\d{2}:\d{2})$/i
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_WITHOUT_TIMEZONE_PATTERN =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/

const crmDateFormatter = new Intl.DateTimeFormat(CRM_LOCALE, {
  timeZone: CRM_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const crmTimeFormatter = new Intl.DateTimeFormat(CRM_LOCALE, {
  timeZone: CRM_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
})

const crmDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CRM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function normalizeCrmDateInput(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  if (HAS_TIMEZONE_PATTERN.test(trimmedValue)) {
    return trimmedValue
  }

  if (DATE_ONLY_PATTERN.test(trimmedValue)) {
    return `${trimmedValue}T00:00:00-03:00`
  }

  if (DATETIME_WITHOUT_TIMEZONE_PATTERN.test(trimmedValue)) {
    return `${trimmedValue.replace(" ", "T")}-03:00`
  }

  return trimmedValue
}

export function safeParseCrmDate(value: Date | string | null | undefined) {
  if (value == null || value === "") {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  }

  const normalizedValue = normalizeCrmDateInput(value)

  if (!normalizedValue) {
    return null
  }

  const parsedDate = new Date(normalizedValue)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

export function formatCrmDateTime(
  value: Date | string | null | undefined,
  fallback = DEFAULT_FALLBACK
) {
  const parsedDate = safeParseCrmDate(value)

  if (!parsedDate) {
    return fallback
  }

  return `${crmDateFormatter.format(parsedDate)} às ${crmTimeFormatter.format(parsedDate)}`
}

export function formatCrmDate(
  value: Date | string | null | undefined,
  fallback = DEFAULT_FALLBACK
) {
  const parsedDate = safeParseCrmDate(value)

  if (!parsedDate) {
    return fallback
  }

  return crmDateFormatter.format(parsedDate)
}

export function formatCrmTime(
  value: Date | string | null | undefined,
  fallback = DEFAULT_FALLBACK
) {
  const parsedDate = safeParseCrmDate(value)

  if (!parsedDate) {
    return fallback
  }

  return crmTimeFormatter.format(parsedDate)
}

export function formatCrmRelativeDateTime(
  value: Date | string | null | undefined,
  fallback = DEFAULT_FALLBACK
) {
  const parsedDate = safeParseCrmDate(value)

  if (!parsedDate) {
    return fallback
  }

  const now = new Date()
  const diffMs = now.getTime() - parsedDate.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMs < 60000) {
    return "agora"
  }

  if (diffMinutes < 60) {
    return `há ${diffMinutes} minuto${diffMinutes === 1 ? "" : "s"}`
  }

  if (diffHours < 24) {
    return `há ${diffHours} hora${diffHours === 1 ? "" : "s"}`
  }

  const todayKey = crmDateKeyFormatter.format(now)
  const targetKey = crmDateKeyFormatter.format(parsedDate)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = crmDateKeyFormatter.format(yesterday)

  if (targetKey === todayKey) {
    return `hoje às ${formatCrmTime(parsedDate, fallback)}`
  }

  if (targetKey === yesterdayKey) {
    return `ontem às ${formatCrmTime(parsedDate, fallback)}`
  }

  return formatCrmDateTime(parsedDate, fallback)
}

export function formatCrmDateForFile(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CRM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "00"
  const day = parts.find((part) => part.type === "day")?.value ?? "00"

  return `${year}-${month}-${day}`
}
