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
})
