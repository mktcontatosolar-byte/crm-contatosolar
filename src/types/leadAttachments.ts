export type LeadAttachment = {
  id: string
  lead_id: string | null
  session_id: string | null
  phone: string | null
  customer_name: string | null
  storage_bucket: string
  storage_path: string
  file_name: string | null
  mime_type: string | null
  file_size: number | null
  attachment_type: string
  origem: string
  metadata: Record<string, unknown> | null
  ativo: boolean
  created_at: string
  created_by: string | null
  deleted_at: string | null
}

export type LeadAttachmentLookup = {
  leadId: string | null
  sessionId: string | null
  phone: string | null
}
