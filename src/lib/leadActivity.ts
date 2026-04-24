import { supabase } from "@/lib/supabase"
import type { LeadActivity, LeadActivityType, Profile } from "@/types"

type LogLeadActivityInput = {
  leadId: string
  usuarioId: string | null
  tipo: LeadActivityType
  descricao: string
  metadata?: Record<string, unknown> | null
}

export async function logLeadActivity({
  leadId,
  usuarioId,
  tipo,
  descricao,
  metadata = null,
}: LogLeadActivityInput) {
  const { error } = await supabase.from("lead_activity").insert({
    lead_id: leadId,
    usuario_id: usuarioId,
    tipo,
    descricao,
    metadata,
  })

  if (error) {
    throw error
  }
}

export async function fetchLeadActivities(leadId: string) {
  const { data, error } = await supabase
    .from("lead_activity")
    .select("id,lead_id,usuario_id,tipo,descricao,metadata,created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  const activities = (data ?? []) as LeadActivity[]
  const userIds = [...new Set(activities.map((activity) => activity.usuario_id).filter(Boolean))]

  if (userIds.length === 0) {
    return activities.map((activity) => ({ ...activity, usuario: null }))
  }

  const { data: usersData, error: usersError } = await supabase
    .from("profiles")
    .select("id,nome,email")
    .in("id", userIds)

  if (usersError) {
    throw usersError
  }

  const usersById = new Map(
    ((usersData ?? []) as Profile[]).map((profile) => [profile.id, profile])
  )

  return activities.map((activity) => ({
    ...activity,
    usuario: activity.usuario_id ? (usersById.get(activity.usuario_id) ?? null) : null,
  }))
}
