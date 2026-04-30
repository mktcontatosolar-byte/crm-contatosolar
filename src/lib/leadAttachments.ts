import { supabase } from "@/lib/supabase"
import type { LeadDetail } from "@/types"
import type { LeadAttachment, LeadAttachmentLookup } from "@/types/leadAttachments"

const LEAD_ATTACHMENTS_TABLE = "lead_attachments"
const LEAD_ATTACHMENTS_BUCKET = "lead-attachments"
const SIGNED_URL_EXPIRATION_SECONDS = 60 * 5
const ENERGY_ATTACHMENT_TYPE = "conta_energia"
const MANUAL_ATTACHMENT_ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const
const MANUAL_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024

type LeadAttachmentRow = LeadAttachment
type ManualLeadAttachmentUploadResponse = {
  success: true
  attachment: LeadAttachment
}
type UploadableLeadAttachmentTarget = Pick<
  LeadDetail,
  "id" | "remotejid" | "telefone_confirmado" | "numero" | "telefone_contato" | "nome_completo"
>

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function normalizeLeadAttachmentPhone(value: string | null | undefined) {
  const normalized = normalizeNullableString(value)

  if (!normalized) {
    return null
  }

  const digits = normalized.replace(/\D/g, "")

  if (!digits) {
    return null
  }

  return digits.startsWith("55") ? digits : `55${digits}`
}

export function buildLeadAttachmentSessionId(phone: string | null | undefined) {
  const normalizedPhone = normalizeLeadAttachmentPhone(phone)
  return normalizedPhone ? `${normalizedPhone}@s.whatsapp.net` : null
}

export function resolveLeadAttachmentLookup(
  lead: Pick<LeadDetail, "id" | "remotejid" | "telefone_confirmado" | "numero">
): LeadAttachmentLookup {
  const normalizedSessionId = normalizeNullableString(lead.remotejid)
  const normalizedPhone = normalizedSessionId
    ? normalizeLeadAttachmentPhone(normalizedSessionId)
    : normalizeLeadAttachmentPhone(lead.telefone_confirmado) ?? normalizeLeadAttachmentPhone(lead.numero)

  return {
    leadId: lead.id ?? null,
    sessionId: normalizedSessionId ?? buildLeadAttachmentSessionId(normalizedPhone),
    phone: normalizedPhone,
  }
}

function compareByCreatedAtDesc(left: Pick<LeadAttachment, "created_at">, right: Pick<LeadAttachment, "created_at">) {
  return right.created_at.localeCompare(left.created_at)
}

function dedupeAttachments(rows: LeadAttachmentRow[]) {
  const seen = new Set<string>()

  return rows.filter((attachment) => {
    if (seen.has(attachment.id)) {
      return false
    }

    seen.add(attachment.id)
    return true
  })
}

async function fetchAttachmentsByField(field: "lead_id" | "session_id" | "phone", value: string) {
  const { data, error } = await supabase
    .from(LEAD_ATTACHMENTS_TABLE)
    .select(
      "id,lead_id,session_id,phone,customer_name,storage_bucket,storage_path,file_name,mime_type,file_size,attachment_type,origem,metadata,ativo,created_at,created_by,deleted_at"
    )
    .eq(field, value)
    .eq("attachment_type", ENERGY_ATTACHMENT_TYPE)
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as LeadAttachmentRow[]
}

export async function fetchLeadAttachments(
  lead: Pick<LeadDetail, "id" | "remotejid" | "telefone_confirmado" | "numero">
) {
  const lookup = resolveLeadAttachmentLookup(lead)
  const collected: LeadAttachmentRow[] = []

  if (lookup.leadId) {
    collected.push(...(await fetchAttachmentsByField("lead_id", lookup.leadId)))
  }

  if (lookup.sessionId) {
    collected.push(...(await fetchAttachmentsByField("session_id", lookup.sessionId)))
  }

  if (lookup.phone) {
    collected.push(...(await fetchAttachmentsByField("phone", lookup.phone)))
  }

  return dedupeAttachments(collected).sort(compareByCreatedAtDesc)
}

export function getLeadAttachmentErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") {
    return fallback
  }

  const candidate = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  }

  if (candidate.code === "42501") {
    return "Sem permissão para acessar a conta de energia deste lead."
  }

  return candidate.details || candidate.hint || candidate.message || fallback
}

export async function createLeadAttachmentSignedUrl(
  attachment: Pick<LeadAttachment, "storage_bucket" | "storage_path" | "file_name">,
  options?: {
    download?: boolean
  }
) {
  const { data, error } = await supabase.storage
    .from(attachment.storage_bucket || LEAD_ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.storage_path, SIGNED_URL_EXPIRATION_SECONDS, {
      download: options?.download ? attachment.file_name ?? true : false,
    })

  if (error) {
    throw error
  }

  return data.signedUrl
}

export function isLeadAttachmentPdf(attachment: Pick<LeadAttachment, "mime_type" | "file_name">) {
  const mimeType = attachment.mime_type?.toLowerCase() ?? ""
  const fileName = attachment.file_name?.toLowerCase() ?? ""
  return mimeType.includes("pdf") || fileName.endsWith(".pdf")
}

export function isLeadAttachmentImage(attachment: Pick<LeadAttachment, "mime_type" | "file_name">) {
  const mimeType = attachment.mime_type?.toLowerCase() ?? ""
  const fileName = attachment.file_name?.toLowerCase() ?? ""
  return mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName)
}

export function getLeadAttachmentTypeLabel(
  attachment: Pick<LeadAttachment, "attachment_type" | "mime_type" | "file_name">
) {
  if (isLeadAttachmentPdf(attachment)) {
    return "PDF"
  }

  if (isLeadAttachmentImage(attachment)) {
    return "Imagem"
  }

  return attachment.mime_type || "Arquivo"
}

export function getLeadAttachmentFriendlyTitle(
  attachment: Pick<LeadAttachment, "attachment_type" | "mime_type" | "file_name">
) {
  if (attachment.attachment_type === "conta_energia") {
    return "Conta de energia"
  }

  if (isLeadAttachmentPdf(attachment)) {
    return "Documento enviado"
  }

  if (isLeadAttachmentImage(attachment)) {
    return "Imagem enviada"
  }

  return "Arquivo enviado"
}

export function getLeadAttachmentOriginLabel(origem: string | null | undefined) {
  return origem === "whatsapp_n8n" ? "WhatsApp/N8N" : normalizeNullableString(origem) ?? "Não informado"
}

function formatAttachmentTimestamp(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")

  return `${year}${month}${day}-${hours}${minutes}${seconds}`
}

function getFileExtension(file: File) {
  const fromName = file.name.split(".").pop()?.trim().toLowerCase()

  if (fromName) {
    return fromName
  }

  switch (file.type) {
    case "application/pdf":
      return "pdf"
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    default:
      return "bin"
  }
}

export function validateManualLeadAttachmentFile(file: File) {
  if (!MANUAL_ATTACHMENT_ALLOWED_TYPES.includes(file.type as (typeof MANUAL_ATTACHMENT_ALLOWED_TYPES)[number])) {
    return "Envie apenas PDF ou imagem da conta de energia."
  }

  if (file.size > MANUAL_ATTACHMENT_MAX_SIZE_BYTES) {
    return "A conta de energia deve ter no máximo 10 MB."
  }

  return null
}

export function validateManualLeadAttachmentOptionalFile(file: File | null | undefined) {
  if (!file) {
    return null
  }

  return validateManualLeadAttachmentFile(file)
}

export function hasActiveEnergyAttachment(attachments: Array<Pick<LeadAttachment, "attachment_type" | "ativo" | "deleted_at">>) {
  return attachments.some(
    (attachment) =>
      attachment.attachment_type === ENERGY_ATTACHMENT_TYPE &&
      attachment.ativo === true &&
      attachment.deleted_at === null
  )
}

export async function uploadLeadAttachmentFromFile({
  file,
  lead,
  createdBy,
}: {
  file: File
  lead: UploadableLeadAttachmentTarget
  createdBy: string | null
}) {
  const validationMessage = validateManualLeadAttachmentFile(file)

  if (validationMessage) {
    throw new Error(validationMessage)
  }

  void createdBy

  if (!lead.id) {
    throw new Error("Não foi possível identificar o lead para anexar a conta de energia.")
  }

  const formData = new FormData()
  formData.append("leadId", lead.id)
  formData.append("file", file)

  const { data, error } = await supabase.functions.invoke<ManualLeadAttachmentUploadResponse>(
    "manual-lead-attachment",
    {
      body: formData,
    }
  )

  if (error) {
    const response = error.context instanceof Response ? error.context : null

    if (response) {
      try {
        const payload = (await response.json()) as {
          error?: string
          message?: string
        }
        throw new Error(payload.error || payload.message || "Não foi possível anexar a conta de energia.")
      } catch (parseError) {
        if (parseError instanceof Error) {
          throw parseError
        }
      }
    }

    throw error
  }

  if (!data?.success || !data.attachment) {
    throw new Error("A Edge Function respondeu sem confirmar o anexo da conta de energia.")
  }

  return {
    storagePath: data.attachment.storage_path,
    fileName: data.attachment.file_name ?? `${formatAttachmentTimestamp()}-manual-conta-energia.${getFileExtension(file)}`,
    sessionId: data.attachment.session_id,
    phone: data.attachment.phone,
  }
}

export {
  ENERGY_ATTACHMENT_TYPE,
  LEAD_ATTACHMENTS_BUCKET,
  LEAD_ATTACHMENTS_TABLE,
  MANUAL_ATTACHMENT_ALLOWED_TYPES,
  MANUAL_ATTACHMENT_MAX_SIZE_BYTES,
  SIGNED_URL_EXPIRATION_SECONDS,
}
