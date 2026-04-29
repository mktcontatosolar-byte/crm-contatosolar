import { supabase } from "@/lib/supabase"

export type AuditLogInput = {
  actorUserId: string | null
  actorName?: string | null
  actorEmail?: string | null
  entityType: string
  entityId?: string | null
  action: string
  description: string
  beforeData?: Record<string, unknown> | null
  afterData?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export type AuditLogRecord = {
  id: string
  actor_user_id: string | null
  actor_name_snapshot: string | null
  actor_email_snapshot: string | null
  entity_type: string
  entity_id: string | null
  action: string
  description: string
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

const AUDIT_LOGS_TABLE = "audit_logs"

export async function logAuditEvent({
  actorUserId,
  actorName = null,
  actorEmail = null,
  entityType,
  entityId = null,
  action,
  description,
  beforeData = null,
  afterData = null,
  metadata = null,
}: AuditLogInput) {
  const { error } = await supabase.from(AUDIT_LOGS_TABLE).insert({
    actor_user_id: actorUserId,
    actor_name_snapshot: actorName,
    actor_email_snapshot: actorEmail,
    entity_type: entityType,
    entity_id: entityId,
    action,
    description,
    before_data: beforeData,
    after_data: afterData,
    metadata,
  })

  if (error) {
    throw error
  }
}

export async function fetchAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from(AUDIT_LOGS_TABLE)
    .select(
      "id,actor_user_id,actor_name_snapshot,actor_email_snapshot,entity_type,entity_id,action,description,before_data,after_data,metadata,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []) as AuditLogRecord[]
}

export { AUDIT_LOGS_TABLE }
