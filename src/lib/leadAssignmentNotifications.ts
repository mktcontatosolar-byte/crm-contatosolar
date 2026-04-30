import { supabase } from "@/lib/supabase"

export type LeadAssignmentNotificationStatus = "sent" | "failed" | "skipped" | "error"
export type LeadAssignmentNotificationEventType = "assignment" | "returned_to_pool"

export type LeadAssignmentNotificationResult = {
  status: LeadAssignmentNotificationStatus
  message?: string
}

type NotifyLeadAssignmentResponse = {
  status?: string
  message?: string
}

function toNotificationStatus(status: string | undefined): LeadAssignmentNotificationStatus {
  if (status === "sent" || status === "failed" || status === "skipped") {
    return status
  }

  return "error"
}

export async function notifyLeadAssignment(
  leadId: string,
  sellerId: string,
  eventType: LeadAssignmentNotificationEventType = "assignment"
): Promise<LeadAssignmentNotificationResult> {
  try {
    const { data, error } = await supabase.functions.invoke("notify-lead-assignment", {
      body: {
        leadId,
        sellerId,
        eventType,
      },
    })

    if (error) {
      console.error("Erro ao notificar atribuição de lead:", error)
      return {
        status: "error",
        message: error.message,
      }
    }

    const payload = (data ?? {}) as NotifyLeadAssignmentResponse

    return {
      status: toNotificationStatus(payload.status),
      message: payload.message,
    }
  } catch (notificationError) {
    console.error("Erro inesperado ao notificar atribuição de lead:", notificationError)

    return {
      status: "error",
      message: notificationError instanceof Error ? notificationError.message : "Erro desconhecido",
    }
  }
}
