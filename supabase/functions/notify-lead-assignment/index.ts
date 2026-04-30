import { createClient } from "npm:@supabase/supabase-js@2"

import { corsHeaders } from "../_shared/cors.ts"

const LEAD_SOURCE_TABLE = "Agente_Base_EnergiaSolar"
const LEAD_STATE_TABLE = "crm_lead_state"
const PROFILES_TABLE = "profiles"
const NOTIFICATIONS_TABLE = "lead_assignment_notifications"
const DUPLICATE_WINDOW_MINUTES = 15
const NOTIFICATION_PROVIDER = "uazapi"

type UserRole = "dono" | "admin" | "corretor"

type NotifyLeadAssignmentPayload = {
  leadId: string
  sellerId: string
}

type LeadRecord = {
  id: string
  nome: string | null
  cidade: string | null
  tipoimovel: string | null
  valorcontaenergia: string | null
  numero: string | null
  telefone_confirmado: string | null
  remotejid: string | null
  origem: string | null
  campanha: string | null
  created_at: string | null
}

type SellerProfile = {
  id: string
  nome: string | null
  email: string | null
  role: UserRole
  ativo: boolean
  whatsapp_number: string | null
  notify_new_leads: boolean
}

type NotificationStatus = "sent" | "failed" | "skipped"

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

  const digitsWithCountryCode = digits.startsWith("55") ? digits : `55${digits}`

  if (digitsWithCountryCode.length < 12 || digitsWithCountryCode.length > 13) {
    return null
  }

  return digitsWithCountryCode
}

function formatValue(value: string | null | undefined) {
  const normalized = normalizeNullableString(value)
  return normalized ?? "Não informado"
}

function buildAssignmentMessage(lead: LeadRecord) {
  return [
    "⚡ Novo lead atribuído para você!",
    "",
    `Cliente: ${formatValue(lead.nome)}`,
    `Cidade: ${formatValue(lead.cidade)}`,
    `Tipo de imóvel: ${formatValue(lead.tipoimovel)}`,
    `Conta de energia: ${formatValue(lead.valorcontaenergia)}`,
    "",
    "Acesse o CRM e dê sequência no atendimento.",
  ].join("\n")
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
        success: false,
        code: "missing_authorization",
        error: "Authorization header is required.",
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
        success: false,
        code: "invalid_session",
        error: "Invalid or expired session.",
      }),
    }
  }

  const { data: profile, error: profileError } = await serviceClient
    .from(PROFILES_TABLE)
    .select("id,role,ativo")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile || !profile.ativo) {
    return {
      ok: false as const,
      response: jsonResponse(403, {
        success: false,
        code: "forbidden",
        error: "User is not allowed to trigger lead notifications.",
      }),
    }
  }

  return {
    ok: true as const,
    callerClient,
    serviceClient,
    requesterId: user.id,
    requesterRole: profile.role as UserRole,
  }
}

async function loadLead(serviceClient: ReturnType<typeof createClient>, leadId: string) {
  const { data, error } = await serviceClient
    .from(LEAD_SOURCE_TABLE)
    .select("id,nome,cidade,tipoimovel,valorcontaenergia,numero,telefone_confirmado,remotejid,origem,campanha,created_at")
    .eq("id", leadId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as LeadRecord | null
}

async function loadSeller(serviceClient: ReturnType<typeof createClient>, sellerId: string) {
  const { data, error } = await serviceClient
    .from(PROFILES_TABLE)
    .select("id,nome,email,role,ativo,whatsapp_number,notify_new_leads")
    .eq("id", sellerId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as SellerProfile | null
}

async function canRequesterTriggerNotification({
  serviceClient,
  requesterId,
  requesterRole,
  sellerId,
  leadId,
}: {
  serviceClient: ReturnType<typeof createClient>
  requesterId: string
  requesterRole: UserRole
  sellerId: string
  leadId: string
}) {
  if (requesterRole === "dono" || requesterRole === "admin") {
    return true
  }

  if (requesterRole !== "corretor") {
    return false
  }

  if (requesterId !== sellerId) {
    return false
  }

  const { data, error } = await serviceClient
    .from(LEAD_STATE_TABLE)
    .select("lead_id,corretor_id")
    .eq("lead_id", leadId)
    .eq("corretor_id", requesterId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return Boolean(data)
}

async function hasRecentSentNotification({
  serviceClient,
  leadId,
  sellerId,
}: {
  serviceClient: ReturnType<typeof createClient>
  leadId: string
  sellerId: string
}) {
  const boundary = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60_000).toISOString()

  const { data, error } = await serviceClient
    .from(NOTIFICATIONS_TABLE)
    .select("id")
    .eq("lead_id", leadId)
    .eq("seller_id", sellerId)
    .eq("event_type", "assignment")
    .eq("status", "sent")
    .gte("created_at", boundary)
    .limit(1)

  if (error) {
    throw error
  }

  return (data ?? []).length > 0
}

async function insertNotificationLog({
  serviceClient,
  leadId,
  sellerId,
  sellerPhone,
  message,
  status,
  providerResponse,
  errorMessage,
  createdBy,
  sentAt,
}: {
  serviceClient: ReturnType<typeof createClient>
  leadId: string
  sellerId: string
  sellerPhone: string | null
  message: string
  status: NotificationStatus
  providerResponse?: unknown
  errorMessage?: string | null
  createdBy: string
  sentAt?: string | null
}) {
  const payload = {
    lead_id: leadId,
    seller_id: sellerId,
    seller_phone: sellerPhone,
    event_type: "assignment",
    message,
    status,
    provider: NOTIFICATION_PROVIDER,
    provider_response: providerResponse ?? null,
    error_message: errorMessage ?? null,
    attempts: 1,
    created_by: createdBy,
    sent_at: sentAt ?? null,
  }

  const { data, error } = await serviceClient
    .from(NOTIFICATIONS_TABLE)
    .insert(payload)
    .select("id")
    .single()

  if (error) {
    throw error
  }

  return data.id as string
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      code: "method_not_allowed",
      error: "Only POST is allowed.",
    })
  }

  const authResult = await requireAuthenticatedUser(request)

  if (!authResult.ok) {
    return authResult.response
  }

  let payload: NotifyLeadAssignmentPayload

  try {
    const body = (await request.json()) as Partial<NotifyLeadAssignmentPayload>
    const leadId = normalizeNullableString(body.leadId)
    const sellerId = normalizeNullableString(body.sellerId)

    if (!leadId || !sellerId) {
      return jsonResponse(400, {
        success: false,
        code: "invalid_payload",
        error: "leadId and sellerId are required.",
      })
    }

    payload = { leadId, sellerId }
  } catch {
    return jsonResponse(400, {
      success: false,
      code: "invalid_json",
      error: "Request body must be valid JSON.",
    })
  }

  const { serviceClient, requesterId, requesterRole } = authResult

  try {
    const isAllowed = await canRequesterTriggerNotification({
      serviceClient,
      requesterId,
      requesterRole,
      sellerId: payload.sellerId,
      leadId: payload.leadId,
    })

    if (!isAllowed) {
      const notificationId = await insertNotificationLog({
        serviceClient,
        leadId: payload.leadId,
        sellerId: payload.sellerId,
        sellerPhone: null,
        message: "Notificação não enviada por falta de permissão.",
        status: "skipped",
        errorMessage: "forbidden",
        createdBy: requesterId,
      })

      return jsonResponse(200, {
        success: true,
        status: "skipped",
        notificationId,
        message: "Usuário sem permissão para acionar notificação para este lead/vendedor.",
      })
    }

    const [lead, seller] = await Promise.all([
      loadLead(serviceClient, payload.leadId),
      loadSeller(serviceClient, payload.sellerId),
    ])

    if (!lead || !seller) {
      return jsonResponse(200, {
        success: true,
        status: "skipped",
        notificationId: null,
        message: !lead
          ? "Notificação não enviada porque o lead não foi encontrado."
          : "Notificação não enviada porque o vendedor não foi encontrado.",
      })
    }

    const message = buildAssignmentMessage(lead)

    if (!seller.ativo) {
      const notificationId = await insertNotificationLog({
        serviceClient,
        leadId: lead.id,
        sellerId: seller.id,
        sellerPhone: null,
        message,
        status: "skipped",
        errorMessage: "seller_inactive",
        createdBy: requesterId,
      })

      return jsonResponse(200, {
        success: true,
        status: "skipped",
        notificationId,
        message: "Notificação não enviada porque o vendedor está inativo.",
      })
    }

    if (seller.role !== "corretor") {
      const notificationId = await insertNotificationLog({
        serviceClient,
        leadId: lead.id,
        sellerId: seller.id,
        sellerPhone: null,
        message,
        status: "skipped",
        errorMessage: "seller_not_broker",
        createdBy: requesterId,
      })

      return jsonResponse(200, {
        success: true,
        status: "skipped",
        notificationId,
        message: "Notificação não enviada porque o destinatário não é vendedor.",
      })
    }

    if (!seller.notify_new_leads) {
      const notificationId = await insertNotificationLog({
        serviceClient,
        leadId: lead.id,
        sellerId: seller.id,
        sellerPhone: seller.whatsapp_number,
        message,
        status: "skipped",
        errorMessage: "seller_notifications_disabled",
        createdBy: requesterId,
      })

      return jsonResponse(200, {
        success: true,
        status: "skipped",
        notificationId,
        message: "Notificação não enviada porque o vendedor desativou avisos de novos leads.",
      })
    }

    const sellerWhatsapp = normalizePhone(seller.whatsapp_number)

    if (!sellerWhatsapp) {
      const notificationId = await insertNotificationLog({
        serviceClient,
        leadId: lead.id,
        sellerId: seller.id,
        sellerPhone: seller.whatsapp_number,
        message,
        status: "skipped",
        errorMessage: "seller_without_whatsapp",
        createdBy: requesterId,
      })

      return jsonResponse(200, {
        success: true,
        status: "skipped",
        notificationId,
        message: "Notificação não enviada porque o vendedor não possui WhatsApp válido cadastrado.",
      })
    }

    const isDuplicate = await hasRecentSentNotification({
      serviceClient,
      leadId: lead.id,
      sellerId: seller.id,
    })

    if (isDuplicate) {
      const notificationId = await insertNotificationLog({
        serviceClient,
        leadId: lead.id,
        sellerId: seller.id,
        sellerPhone: sellerWhatsapp,
        message,
        status: "skipped",
        errorMessage: "duplicate_window",
        createdBy: requesterId,
      })

      return jsonResponse(200, {
        success: true,
        status: "skipped",
        notificationId,
        message: "Notificação já enviada recentemente para este lead e vendedor.",
      })
    }

    const uazapiUrl = getEnv("UAZAPI_SEND_TEXT_URL")
    const uazapiToken = getEnv("UAZAPI_TOKEN")

    let providerResponsePayload: unknown = null
    let providerErrorMessage: string | null = null
    let wasSent = false

    try {
      const providerResponse = await fetch(uazapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: uazapiToken,
        },
        body: JSON.stringify({
          number: sellerWhatsapp,
          text: message,
        }),
      })

      const responseText = await providerResponse.text()
      let parsedResponse: unknown = responseText

      try {
        parsedResponse = responseText ? JSON.parse(responseText) : null
      } catch {
        parsedResponse = responseText
      }

      providerResponsePayload = {
        httpStatus: providerResponse.status,
        body: parsedResponse,
      }

      if (providerResponse.ok) {
        wasSent = true
      } else {
        providerErrorMessage = `uazapi_http_${providerResponse.status}`
      }
    } catch (providerError) {
      providerErrorMessage = providerError instanceof Error ? providerError.message : "uazapi_request_failed"
      providerResponsePayload = {
        error: providerErrorMessage,
      }
    }

    if (wasSent) {
      const notificationId = await insertNotificationLog({
        serviceClient,
        leadId: lead.id,
        sellerId: seller.id,
        sellerPhone: sellerWhatsapp,
        message,
        status: "sent",
        providerResponse: providerResponsePayload,
        createdBy: requesterId,
        sentAt: new Date().toISOString(),
      })

      return jsonResponse(200, {
        success: true,
        status: "sent",
        notificationId,
        message: "Notificação enviada com sucesso.",
      })
    }

    const notificationId = await insertNotificationLog({
      serviceClient,
      leadId: lead.id,
      sellerId: seller.id,
      sellerPhone: sellerWhatsapp,
      message,
      status: "failed",
      providerResponse: providerResponsePayload,
      errorMessage: providerErrorMessage,
      createdBy: requesterId,
    })

    return jsonResponse(200, {
      success: true,
      status: "failed",
      notificationId,
      message: "Não foi possível enviar a notificação por WhatsApp.",
    })
  } catch (error) {
    console.error("Unexpected notify-lead-assignment error:", error)

    return jsonResponse(500, {
      success: false,
      code: "unexpected_error",
      error: "Não foi possível processar a notificação deste lead agora.",
    })
  }
})
