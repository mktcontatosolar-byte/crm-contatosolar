import { describe, expect, it } from "vitest"

import {
  CRM_LOCALE,
  CRM_TIME_ZONE,
  formatCrmDate,
  formatCrmDateTime,
  formatCrmTime,
  safeParseCrmDate,
} from "@/lib/dateTime"

describe("dateTime helpers", () => {
  it("expõe locale e timezone do CRM", () => {
    expect(CRM_LOCALE).toBe("pt-BR")
    expect(CRM_TIME_ZONE).toBe("America/Sao_Paulo")
  })

  it("formata data ISO em UTC no fuso de Sao Paulo", () => {
    expect(formatCrmDateTime("2026-04-30T18:47:00Z")).toBe("30/04/2026 às 15:47")
  })

  it("mantém hora correta para data com offset explícito", () => {
    expect(formatCrmDateTime("2026-04-30T15:47:00-03:00")).toBe("30/04/2026 às 15:47")
  })

  it("interpreta data sem timezone como horario local do Brasil", () => {
    expect(formatCrmDateTime("2026-04-30 15:47:00")).toBe("30/04/2026 às 15:47")
  })

  it("retorna fallback para null, undefined e string vazia", () => {
    expect(formatCrmDateTime(null)).toBe("—")
    expect(formatCrmDateTime(undefined)).toBe("—")
    expect(formatCrmDateTime("")).toBe("—")
  })

  it("retorna fallback para data inválida", () => {
    expect(formatCrmDateTime("data-invalida")).toBe("—")
    expect(safeParseCrmDate("data-invalida")).toBeNull()
  })

  it("formata apenas a data em pt-BR", () => {
    expect(formatCrmDate("2026-04-30T18:47:00Z")).toBe("30/04/2026")
    expect(formatCrmDate("2026-04-30")).toBe("30/04/2026")
  })

  it("formata apenas a hora em pt-BR", () => {
    expect(formatCrmTime("2026-04-30T18:47:00Z")).toBe("15:47")
  })

  it("normaliza strings sem timezone em safeParseCrmDate", () => {
    expect(safeParseCrmDate("2026-04-30 15:47:00")?.toISOString()).toBe("2026-04-30T18:47:00.000Z")
    expect(safeParseCrmDate("2026-04-30")?.toISOString()).toBe("2026-04-30T03:00:00.000Z")
  })
})
