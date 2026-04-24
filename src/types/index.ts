export type UserRole = 'admin' | 'corretor'

export type Profile = {
  id: string
  email: string | null
  nome: string | null
  role: UserRole
  ativo: boolean
  created_at: string
  updated_at?: string
}

export type KanbanStage = {
  id: string
  nome: string
  ordem: number
  cor: string
  is_final: boolean
}

export type LeadTag = {
  lead_id: string
  tag_id: string
}

export type Lead = {
  id: string
  remotejid: string
  numero: string | null
  nome_completo: string | null
  email: string | null
  telefone_contato: string | null
  horario_preferido: string | null
  tem_nome: boolean
  tem_email: boolean
  tem_telefone: boolean
  tem_horario: boolean
  status_conversa: string
  campanha: string | null
  origem: string | null
  outra_info: string | null
  corretor_id: string | null
  assumed_at?: string | null
  stage_id: string | null
  arquivado: boolean
  ia_paused: boolean
  followup_count: number
  first_response_at: string
  last_interaction_at: string
  created_at: string
  corretor?: Profile
  stage?: KanbanStage
}

export type Tag = {
  id: string
  nome: string
  cor: string
  created_by: string | null
}

export type LeadNote = {
  id: string
  lead_id: string
  author_id: string
  content: string
  created_at: string
  author?: Profile
}

export type ChatMessage = {
  id: string
  lead_id: string
  role: 'user' | 'bot'
  content: string
  created_at: string
}

export type LeadActivityType =
  | 'atribuicao'
  | 'pool'
  | 'etapa'
  | 'arquivamento'
  | 'desarquivamento'
  | 'ia'

export type LeadActivity = {
  id: string
  lead_id: string
  usuario_id: string | null
  tipo: LeadActivityType
  descricao: string
  metadata: Record<string, unknown> | null
  created_at: string
  usuario?: Profile | null
}

export type LeadDetail = Pick<
  Lead,
  | 'id'
  | 'remotejid'
  | 'nome_completo'
  | 'email'
  | 'telefone_contato'
  | 'horario_preferido'
  | 'status_conversa'
  | 'corretor_id'
  | 'assumed_at'
  | 'stage_id'
  | 'arquivado'
  | 'ia_paused'
  | 'campanha'
  | 'origem'
  | 'outra_info'
  | 'created_at'
  | 'first_response_at'
  | 'last_interaction_at'
>
