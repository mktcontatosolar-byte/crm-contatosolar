import { describe, expect, it } from "vitest"

import { buildSessionIdCandidates } from "@/lib/crmLeads"
import {
  buildLeadAttachmentSessionId,
  normalizeLeadAttachmentPhone,
  resolveLeadAttachmentLookup,
} from "@/lib/leadAttachments"

describe("lead identifiers", () => {
  it("normaliza telefone com máscara para dígitos com DDI 55", () => {
    expect(normalizeLeadAttachmentPhone("(11) 99876-5432")).toBe("5511998765432")
  })

  it("mantém telefone que já vem com 55", () => {
    expect(normalizeLeadAttachmentPhone("5511987654321")).toBe("5511987654321")
  })

  it("gera session_id com sufixo @s.whatsapp.net", () => {
    expect(buildLeadAttachmentSessionId("(11) 99876-5432")).toBe("5511998765432@s.whatsapp.net")
  })

  it("resolve lookup priorizando remotejid existente", () => {
    const lookup = resolveLeadAttachmentLookup({
      id: "lead-1",
      remotejid: "5511998765432@c.us",
      telefone_confirmado: "(11) 4000-0000",
      numero: "(11) 3000-0000",
    })

    expect(lookup).toEqual({
      leadId: "lead-1",
      sessionId: "5511998765432@c.us",
      phone: "5511998765432",
    })
  })

  it("resolve lookup usa fallback telefone_confirmado e gera session_id quando não há remotejid", () => {
    const lookup = resolveLeadAttachmentLookup({
      id: "lead-2",
      remotejid: "",
      telefone_confirmado: "(21) 98765-4321",
      numero: "(21) 3000-0000",
    })

    expect(lookup).toEqual({
      leadId: "lead-2",
      sessionId: "5521987654321@s.whatsapp.net",
      phone: "5521987654321",
    })
  })

  it("resolve lookup usa fallback numero quando telefone_confirmado está ausente", () => {
    const lookup = resolveLeadAttachmentLookup({
      id: "lead-3",
      remotejid: "",
      telefone_confirmado: null,
      numero: "11 3333-4444",
    })

    expect(lookup).toEqual({
      leadId: "lead-3",
      sessionId: "551133334444@s.whatsapp.net",
      phone: "551133334444",
    })
  })

  it("normalização retorna null para telefone inválido", () => {
    expect(normalizeLeadAttachmentPhone("   ")).toBeNull()
    expect(normalizeLeadAttachmentPhone("abc")).toBeNull()
    expect(buildLeadAttachmentSessionId(null)).toBeNull()
  })

  it("buildSessionIdCandidates cobre variações @s.whatsapp.net e @c.us sem duplicar", () => {
    const candidates = buildSessionIdCandidates("(11) 99876-5432")
    const uniqueCount = new Set(candidates).size

    expect(uniqueCount).toBe(candidates.length)
    expect(candidates).toContain("11998765432")
    expect(candidates).toContain("5511998765432")
    expect(candidates).toContain("11998765432@s.whatsapp.net")
    expect(candidates).toContain("11998765432@c.us")
    expect(candidates).toContain("5511998765432@s.whatsapp.net")
    expect(candidates).toContain("5511998765432@c.us")
  })

  it("buildSessionIdCandidates retorna vazio para entrada em branco", () => {
    expect(buildSessionIdCandidates("   ")).toEqual([])
  })

  it("buildSessionIdCandidates a partir de @c.us inclui variantes locais e com 55", () => {
    const candidates = buildSessionIdCandidates("5511998765432@c.us")

    expect(candidates).toContain("5511998765432@c.us")
    expect(candidates).toContain("5511998765432@s.whatsapp.net")
    expect(candidates).toContain("11998765432")
    expect(candidates).toContain("11998765432@c.us")
    expect(candidates).toContain("11998765432@s.whatsapp.net")
  })
})
