import { createClient } from "npm:@supabase/supabase-js@2"

import { corsHeaders } from "../_shared/cors.ts"

const LEAD_ATTACHMENTS_BUCKET = "lead-attachments"
const LEAD_ATTACHMENTS_TABLE = "lead_attachments"
const LEAD_SOURCE_TABLE = "Agente_Base_EnergiaSolar"
const ENERGY_ATTACHMENT_TYPE = "conta_energia"
const MANUAL_ATTACHMENT_ORIGIN = "manual_crm"
const MANUAL_ATTACHMENT_ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
])
const MANUAL_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024

type LeadSourceRecord = {
  id: string
  nome: string | null
  numero: string | null
  telefone_confirmado: string | null
  remotejid: string | null
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

function getEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

function normalizeNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizePhone(rawPhone: string | null | undefined) {
  const normalized = normalizeNullableString(rawPhone)

  if (!normalized) {
    return null
  }

  const digits = normalized.replace(/\D/g, "")

  if (!digits) {
    return null
  }

  return digits.startsWith("55") ? digits : `55${digits}`
}

function buildSessionId(phone: string | null) {
  return phone ? `${phone}@s.whatsapp.net` : null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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

function formatAttachmentTimestamp(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0")

  return `${year}${month}${day}-${hours}${minutes}${seconds}${milliseconds}`
}

async function requireAuthenticatedUser(request: Request) {
  const supabaseUrl = getEnv("SUPABASE_URL")
  const publishableKey = getEnv("SUPABASE_ANON_KEY")
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY")
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization")

  if (!authHeader) {
    return {
      ok: false as const,
      response: jsonResponse(401, {
        error: "Authorization header is required.",
        code: "missing_authorization",
      }),
    }
  }

  const callerClient = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()

  if (userError || !user) {
    return {
      ok: false as const,
      response: jsonResponse(401, {
        error: "Invalid or expired session.",
        code: "invalid_session",
      }),
    }
  }

  return {
    ok: true as const,
    callerClient,
    serviceClient,
    user,
  }
}

async function loadLead(serviceClient: ReturnType<typeof createClient>, leadId: string) {
  const { data, error } = await serviceClient
    .from(LEAD_SOURCE_TABLE)
    .select("id,nome,numero,telefone_confirmado,remotejid")
    .eq("id", leadId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as LeadSourceRecord | null
}

async function canAttachToLead(
  callerClient: ReturnType<typeof createClient>,
  lead: LeadSourceRecord,
  phone: string | null,
  sessionId: string | null
) {
  const { data, error } = await callerClient.rpc("can_access_lead_attachment", {
    target_lead_id: lead.id,
    target_session_id: sessionId,
    target_phone: phone,
  })

  if (error) {
    throw error
  }

  return data === true
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return jsonResponse(405, {
      error: "Only POST is allowed.",
      code: "method_not_allowed",
    })
  }

  const authResult = await requireAuthenticatedUser(request)

  if (!authResult.ok) {
    return authResult.response
  }

  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return jsonResponse(400, {
      error: "Request body must be multipart/form-data.",
      code: "invalid_form_data",
    })
  }

  const leadId = normalizeNullableString(formData.get("leadId"))
  const uploadedFile = formData.get("file")

  if (!leadId || !isUuid(leadId)) {
    return jsonResponse(400, {
      error: "Lead inválido para anexar a conta de energia.",
      code: "invalid_lead_id",
    })
  }

  if (!(uploadedFile instanceof File)) {
    return jsonResponse(400, {
      error: "Selecione um arquivo para anexar.",
      code: "missing_file",
    })
  }

  if (!MANUAL_ATTACHMENT_ALLOWED_TYPES.has(uploadedFile.type)) {
    return jsonResponse(400, {
      error: "Envie apenas PDF ou imagem da conta de energia.",
      code: "invalid_file_type",
    })
  }

  if (uploadedFile.size > MANUAL_ATTACHMENT_MAX_SIZE_BYTES) {
    return jsonResponse(400, {
      error: "A conta de energia deve ter no máximo 10 MB.",
      code: "file_too_large",
    })
  }

  let lead: LeadSourceRecord | null

  try {
    lead = await loadLead(authResult.serviceClient, leadId)
  } catch (error) {
    console.error("Falha ao carregar lead para anexo manual:", error)
    return jsonResponse(500, {
      error: "Não foi possível validar o lead para anexar a conta.",
      code: "lead_lookup_failed",
    })
  }

  if (!lead) {
    return jsonResponse(404, {
      error: "Lead não encontrado para anexar a conta.",
      code: "lead_not_found",
    })
  }

  const normalizedPhone =
    normalizePhone(lead.remotejid) ??
    normalizePhone(lead.telefone_confirmado) ??
    normalizePhone(lead.numero)
  const sessionId = normalizeNullableString(lead.remotejid) ?? buildSessionId(normalizedPhone)

  try {
    const allowed = await canAttachToLead(authResult.callerClient, lead, normalizedPhone, sessionId)

    if (!allowed) {
      return jsonResponse(403, {
        error: "Você não tem permissão para anexar a conta de energia deste lead.",
        code: "forbidden",
      })
    }
  } catch (error) {
    console.error("Falha ao validar permissão do anexo manual:", error)
    return jsonResponse(500, {
      error: "Não foi possível validar a permissão para anexar a conta.",
      code: "permission_check_failed",
    })
  }

  const extension = getFileExtension(uploadedFile)
  const timestamp = formatAttachmentTimestamp()
  const uniqueSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  const phoneFolder = normalizedPhone ?? "sem-telefone"
  const fileName = `${timestamp}-${uniqueSuffix}-manual-conta-energia.${extension}`
  const storagePath = `contas-energia/${phoneFolder}/${fileName}`

  const { error: uploadError } = await authResult.serviceClient.storage
    .from(LEAD_ATTACHMENTS_BUCKET)
    .upload(storagePath, uploadedFile, {
      cacheControl: "3600",
      contentType: uploadedFile.type,
      upsert: false,
    })

  if (uploadError) {
    console.error("Falha ao subir arquivo no Storage:", uploadError)
    return jsonResponse(500, {
      error: "Não foi possível enviar a conta de energia para o armazenamento.",
      code: "storage_upload_failed",
    })
  }

  const { data: attachment, error: insertError } = await authResult.serviceClient
    .from(LEAD_ATTACHMENTS_TABLE)
    .insert({
      lead_id: lead.id,
      session_id: sessionId,
      phone: normalizedPhone,
      customer_name: lead.nome ?? null,
      storage_bucket: LEAD_ATTACHMENTS_BUCKET,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: uploadedFile.type,
      file_size: uploadedFile.size,
      attachment_type: ENERGY_ATTACHMENT_TYPE,
      origem: MANUAL_ATTACHMENT_ORIGIN,
      ativo: true,
      created_by: authResult.user.id,
      metadata: {
        original_file_name: uploadedFile.name,
        upload_source: MANUAL_ATTACHMENT_ORIGIN,
      },
    })
    .select(
      "id,lead_id,session_id,phone,customer_name,storage_bucket,storage_path,file_name,mime_type,file_size,attachment_type,origem,metadata,ativo,created_at,created_by,deleted_at"
    )
    .single()

  if (insertError) {
    console.error("Falha ao inserir lead_attachments após upload:", insertError)

    const { error: cleanupError } = await authResult.serviceClient.storage
      .from(LEAD_ATTACHMENTS_BUCKET)
      .remove([storagePath])

    if (cleanupError) {
      console.error("Falha ao remover arquivo órfão após erro de insert:", cleanupError)
    }

    return jsonResponse(500, {
      error: "Não foi possível registrar a conta de energia anexada.",
      code: "attachment_insert_failed",
    })
  }

  return jsonResponse(200, {
    success: true,
    attachment,
  })
})
