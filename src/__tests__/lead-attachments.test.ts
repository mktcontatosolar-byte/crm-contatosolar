import { describe, expect, it } from "vitest"

import {
  hasActiveEnergyAttachment,
  validateManualLeadAttachmentFile,
  validateManualLeadAttachmentOptionalFile,
} from "@/lib/leadAttachments"

function createFile(name: string, type: string, sizeInBytes: number) {
  const content = "a".repeat(Math.max(1, sizeInBytes))
  return new File([content], name, { type })
}

describe("lead attachments", () => {
  it("aceita PDF", () => {
    const file = createFile("conta.pdf", "application/pdf", 1024)
    expect(validateManualLeadAttachmentFile(file)).toBeNull()
  })

  it("aceita JPG/JPEG", () => {
    const file = createFile("conta.jpg", "image/jpeg", 1024)
    expect(validateManualLeadAttachmentFile(file)).toBeNull()
  })

  it("aceita PNG", () => {
    const file = createFile("conta.png", "image/png", 1024)
    expect(validateManualLeadAttachmentFile(file)).toBeNull()
  })

  it("aceita WEBP", () => {
    const file = createFile("conta.webp", "image/webp", 1024)
    expect(validateManualLeadAttachmentFile(file)).toBeNull()
  })

  it("rejeita DOC/DOCX e EXE com mensagem correta", () => {
    const doc = createFile(
      "conta.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      1024
    )
    const exe = createFile("conta.exe", "application/x-msdownload", 1024)

    expect(validateManualLeadAttachmentFile(doc)).toBe("Envie apenas PDF ou imagem da conta de energia.")
    expect(validateManualLeadAttachmentFile(exe)).toBe("Envie apenas PDF ou imagem da conta de energia.")
  })

  it("rejeita arquivo acima de 10MB", () => {
    const big = createFile("conta.pdf", "application/pdf", 10 * 1024 * 1024 + 1)
    expect(validateManualLeadAttachmentFile(big)).toBe("A conta de energia deve ter no máximo 10 MB.")
  })

  it("arquivo opcional nulo não quebra fluxo", () => {
    expect(validateManualLeadAttachmentOptionalFile(undefined)).toBeNull()
    expect(validateManualLeadAttachmentOptionalFile(null)).toBeNull()
  })

  it("regra Conta recebida: verdadeiro somente para conta_energia ativa e não deletada", () => {
    expect(
      hasActiveEnergyAttachment([
        { attachment_type: "conta_energia", ativo: true, deleted_at: null },
      ])
    ).toBe(true)

    expect(
      hasActiveEnergyAttachment([
        { attachment_type: "outro", ativo: true, deleted_at: null },
      ])
    ).toBe(false)

    expect(
      hasActiveEnergyAttachment([
        { attachment_type: "conta_energia", ativo: false, deleted_at: null },
      ])
    ).toBe(false)

    expect(
      hasActiveEnergyAttachment([
        { attachment_type: "conta_energia", ativo: true, deleted_at: "2026-01-01T00:00:00Z" },
      ])
    ).toBe(false)

    expect(hasActiveEnergyAttachment([])).toBe(false)
  })
})
