import { describe, expect, it } from "vitest"

import {
  getLeadAttachmentOriginLabel,
  getLeadAttachmentTypeLabel,
  hasActiveEnergyAttachment,
  isLeadAttachmentImage,
  isLeadAttachmentPdf,
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

  it("arquivo opcional válido mantém comportamento de validação", () => {
    const file = createFile("conta.png", "image/png", 1024)
    expect(validateManualLeadAttachmentOptionalFile(file)).toBeNull()
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

  it("regra Conta recebida em lista com múltiplos anexos", () => {
    const attachments = [
      { attachment_type: "outro", ativo: true, deleted_at: null },
      { attachment_type: "conta_energia", ativo: false, deleted_at: null },
      { attachment_type: "conta_energia", ativo: true, deleted_at: null },
    ]

    expect(hasActiveEnergyAttachment(attachments)).toBe(true)
  })

  it("reconhece origem manual_crm e whatsapp_n8n", () => {
    expect(getLeadAttachmentOriginLabel("manual_crm")).toBe("manual_crm")
    expect(getLeadAttachmentOriginLabel("whatsapp_n8n")).toBe("WhatsApp/N8N")
  })

  it("detecta tipo PDF por mime e extensão", () => {
    expect(isLeadAttachmentPdf({ mime_type: "application/pdf", file_name: "conta.bin" })).toBe(true)
    expect(isLeadAttachmentPdf({ mime_type: "application/octet-stream", file_name: "conta.PDF" })).toBe(true)
    expect(isLeadAttachmentPdf({ mime_type: "image/png", file_name: "conta.png" })).toBe(false)
  })

  it("detecta tipo imagem por mime e extensão", () => {
    expect(isLeadAttachmentImage({ mime_type: "image/jpeg", file_name: "x.bin" })).toBe(true)
    expect(isLeadAttachmentImage({ mime_type: "application/octet-stream", file_name: "conta.webp" })).toBe(true)
    expect(isLeadAttachmentImage({ mime_type: "application/pdf", file_name: "conta.pdf" })).toBe(false)
  })

  it("gera label de tipo de arquivo com fallback correto", () => {
    expect(getLeadAttachmentTypeLabel({ attachment_type: "conta_energia", mime_type: "application/pdf", file_name: "a" })).toBe("PDF")
    expect(getLeadAttachmentTypeLabel({ attachment_type: "conta_energia", mime_type: "image/png", file_name: "a" })).toBe("Imagem")
    expect(getLeadAttachmentTypeLabel({ attachment_type: "conta_energia", mime_type: "application/msword", file_name: "a.doc" })).toBe("application/msword")
    expect(getLeadAttachmentTypeLabel({ attachment_type: "conta_energia", mime_type: null, file_name: null })).toBe("Arquivo")
  })
})
