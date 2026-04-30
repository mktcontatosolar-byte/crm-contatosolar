import { describe, expect, it } from "vitest"

import {
  ensureDate,
  extractPhoneFromRemoteJid,
  formatBrazilPhone,
  isDateBefore,
  mapLead,
  normalizeLeadEntryType,
  normalizeLeadTimestamp,
} from "@/lib/crmLeads"

function buildBaseLeadRow(overrides: Partial<Parameters<typeof mapLead>[0]> = {}): Parameters<typeof mapLead>[0] {
  return {
    id: "lead-1",
    data: "2026-04-20 10:00:00",
    nome: "Joao",
    numero: "11987654321",
    tipoimovel: "Casa",
    valorcontaenergia: "350",
    outra_info: null,
    conta: true,
    urgencia: "alta",
    telefone_confirmado: "(11) 98765-4321",
    cidade: "Sao Paulo",
    remotejid: "5511987654321@s.whatsapp.net",
    created_at: "2026-04-20 10:00:00",
    followup_count: 1,
    status_conversa: "ativo",
    last_interaction_at: "2026-04-21 09:00:00",
    origem: "Meta ADS",
    email: "LEAD@EXAMPLE.COM",
    campanha: "campanha-a",
    horario_preferido: "manha",
    lead_entry_type: "meta_ads",
    manual_created_by: null,
    ...overrides,
  }
}

describe("crmLeads pure helpers", () => {
  describe("telefone", () => {
    it("extrai dígitos de remotejid válido", () => {
      expect(extractPhoneFromRemoteJid("5511987654321@s.whatsapp.net")).toBe("5511987654321")
    })

    it("retorna null para remotejid vazio/inválido", () => {
      expect(extractPhoneFromRemoteJid(null)).toBeNull()
      expect(extractPhoneFromRemoteJid("abc@c.us")).toBeNull()
    })

    it("formata telefone com máscara e com 55", () => {
      expect(formatBrazilPhone("(11) 98765-4321")).toBe("(11) 98765-4321")
      expect(formatBrazilPhone("5511987654321")).toBe("+55 (11) 98765-4321")
    })

    it("formata telefone de 10 dígitos e mantém fallback de inválido", () => {
      expect(formatBrazilPhone("1133334444")).toBe("(11) 3333-4444")
      expect(formatBrazilPhone("  ")) .toBe("")
      expect(formatBrazilPhone(null)).toBeNull()
    })
  })

  describe("datas", () => {
    it("normaliza timestamp sem timezone para -03:00", () => {
      expect(normalizeLeadTimestamp("2026-04-20 10:30:00")).toBe("2026-04-20T10:30:00-03:00")
    })

    it("mantém timestamp com timezone explícito", () => {
      expect(normalizeLeadTimestamp("2026-04-20T10:30:00Z")).toBe("2026-04-20T10:30:00Z")
    })

    it("retorna null para data vazia", () => {
      expect(normalizeLeadTimestamp("   ")).toBeNull()
      expect(normalizeLeadTimestamp(null)).toBeNull()
    })

    it("ensureDate usa fallback e isDateBefore compara datas válidas", () => {
      expect(ensureDate(null, "2026-04-20T00:00:00Z")).toBe("2026-04-20T00:00:00Z")
      expect(isDateBefore("2026-04-20T00:00:00Z", "2026-04-21T00:00:00Z")).toBe(true)
      expect(isDateBefore("data-invalida", "2026-04-21T00:00:00Z")).toBe(false)
    })
  })

  describe("mapeamento de lead", () => {
    it("mapeia lead com state parcial e mantém status arquivado/ia conforme state", () => {
      const lead = mapLead(buildBaseLeadRow(), {
        lead_id: "lead-1",
        corretor_id: "user-1",
        assumed_at: null,
        stage_id: null,
        arquivado: true,
        ia_paused: true,
        first_response_at: null,
        created_at: "2026-04-20T00:00:00Z",
        updated_at: "2026-04-20T01:00:00Z",
      })

      expect(lead.corretor_id).toBe("user-1")
      expect(lead.arquivado).toBe(true)
      expect(lead.ia_paused).toBe(true)
    })

    it("mapeia lead sem state associado com defaults seguros", () => {
      const lead = mapLead(buildBaseLeadRow(), null)

      expect(lead.corretor_id).toBeNull()
      expect(lead.stage_id).toBeNull()
      expect(lead.arquivado).toBe(false)
      expect(lead.ia_paused).toBe(false)
    })

    it("trata campos nulos (nome, cidade, tipoimovel, valorcontaenergia)", () => {
      const lead = mapLead(
        buildBaseLeadRow({
          nome: null,
          cidade: null,
          tipoimovel: null,
          valorcontaenergia: null,
          numero: null,
          remotejid: null,
          email: null,
          status_conversa: null,
        }),
        null
      )

      expect(lead.nome_completo).toBeNull()
      expect(lead.cidade).toBeNull()
      expect(lead.tipoimovel).toBeNull()
      expect(lead.valorcontaenergia).toBeNull()
      expect(lead.tem_nome).toBe(false)
      expect(lead.tem_telefone).toBe(false)
      expect(lead.tem_email).toBe(false)
      expect(lead.status_conversa).toBe("novo")
    })

    it("usa remotejid para fallback de telefone quando numero ausente", () => {
      const lead = mapLead(
        buildBaseLeadRow({
          numero: null,
          remotejid: "5511912345678@c.us",
        }),
        null
      )

      expect(lead.telefone_contato).toBe("+55 (11) 91234-5678")
      expect(lead.tem_telefone).toBe(true)
    })

    it("normaliza email para minúsculas e origem padrão em lead não manual", () => {
      const lead = mapLead(
        buildBaseLeadRow({
          email: "TESTE@MAIL.COM",
          origem: null,
          lead_entry_type: "meta_ads",
          manual_created_by: null,
        }),
        null
      )

      expect(lead.email).toBe("teste@mail.com")
      expect(lead.origem).toBe("Meta ADS")
      expect(lead.lead_entry_type).toBe("meta_ads")
    })

    it("marca lead como manual quando lead_entry_type ou manual_created_by indicam manual", () => {
      const byType = mapLead(buildBaseLeadRow({ lead_entry_type: "manual", origem: "Meta ADS" }), null)
      const byCreator = mapLead(buildBaseLeadRow({ lead_entry_type: "meta_ads", manual_created_by: "user-1", origem: null }), null)

      expect(byType.lead_entry_type).toBe("manual")
      expect(byType.horario_preferido).toBe("manha")
      expect(byCreator.lead_entry_type).toBe("manual")
      expect(byCreator.origem).toBeNull()
    })

    it("last_interaction_at não fica antes de created_at", () => {
      const lead = mapLead(
        buildBaseLeadRow({
          created_at: "2026-04-22 10:00:00",
          last_interaction_at: "2026-04-21 10:00:00",
        }),
        null
      )

      expect(new Date(lead.last_interaction_at ?? "").getTime()).toBeGreaterThanOrEqual(
        new Date(lead.created_at).getTime()
      )
    })
  })

  it("normaliza tipo de entrada do lead", () => {
    expect(normalizeLeadEntryType("manual")).toBe("manual")
    expect(normalizeLeadEntryType("MANUAL")).toBe("manual")
    expect(normalizeLeadEntryType("meta_ads")).toBe("meta_ads")
    expect(normalizeLeadEntryType(null)).toBe("meta_ads")
  })
})
