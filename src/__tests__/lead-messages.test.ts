import { describe, expect, it } from "vitest"

import { cleanLeadConversationMessage, shouldHideConversationMessage } from "@/lib/leadMessages"

describe("lead messages", () => {
  it("mantém mensagem normal sem alterações", () => {
    expect(cleanLeadConversationMessage("Boa noite")).toBe("Boa noite")
  })

  it("extrai somente conteúdo após [MENSAGEM DO LEAD]", () => {
    const raw = `[ESTADO ATUAL DO LEAD]\nEm atendimento\n[MENSAGEM DO LEAD]\nBoa noite`
    expect(cleanLeadConversationMessage(raw)).toBe("Boa noite")
  })

  it("aceita marcador case-insensitive", () => {
    const raw = "[mensagem do lead]   Oi, tudo bem?"
    expect(cleanLeadConversationMessage(raw)).toBe("Oi, tudo bem?")
  })

  it("mantém conteúdo quando existe estado atual sem marcador de mensagem", () => {
    const raw = "[ESTADO ATUAL DO LEAD]\nLead aguardando retorno"
    expect(cleanLeadConversationMessage(raw)).toBe(raw)
  })

  it("retorna string original para mensagem vazia ou só espaços", () => {
    expect(cleanLeadConversationMessage("")).toBe("")
    expect(cleanLeadConversationMessage("   ")).toBe("   ")
  })

  it("faz fallback seguro quando não sobra conteúdo", () => {
    const raw = "[MENSAGEM DO LEAD]"
    expect(cleanLeadConversationMessage(raw)).toBe(raw)
  })

  it("filtra mensagens internas por marcador conhecido", () => {
    expect(shouldHideConversationMessage("System: instrução interna")).toBe(true)
    expect(shouldHideConversationMessage("PROMPT INTERNO para agente")).toBe(true)
    expect(shouldHideConversationMessage("Pergunta obrigatória: confirmar dados")).toBe(true)
    expect(shouldHideConversationMessage("# dados do lead\nNome: Teste")).toBe(true)
  })

  it("não filtra mensagens legítimas do cliente", () => {
    expect(shouldHideConversationMessage("Boa noite, quero orçamento")).toBe(false)
  })
})
