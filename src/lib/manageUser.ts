import { supabase } from "@/lib/supabase"

export type ManagedUserRole = "dono" | "admin" | "corretor"

export type CreateManagedUserPayload = {
  action: "createUser"
  email: string
  password: string
  nome: string
  role: ManagedUserRole
  ativo: boolean
}

export type DeleteManagedUserPayload = {
  action: "deleteUser"
  userId: string
}

export type ManageUserPayload = CreateManagedUserPayload | DeleteManagedUserPayload

type CreateManagedUserResponse = {
  success: true
  action: "createUser"
  user: {
    id: string
    email: string
    nome: string
    role: ManagedUserRole
    ativo: boolean
  }
}

type DeleteManagedUserResponse = {
  success: true
  action: "deleteUser"
  deletedUserId: string
  warnings?: string[]
}

type ManageUserErrorResponse = {
  success: false
  code: string
  error: string
}

export type ManageUserResponse =
  | CreateManagedUserResponse
  | DeleteManagedUserResponse
  | ManageUserErrorResponse

export class ManageUserRequestError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = "ManageUserRequestError"
    this.code = code
  }
}

const MANAGE_USER_ERROR_MESSAGES: Record<string, string> = {
  admin_role_scope_forbidden: "Admins só podem criar contas de vendedor.",
  assigned_leads_block: "Este usuário ainda possui leads ativos vinculados.",
  forbidden: "Somente donos ou administradores ativos podem gerenciar usuários.",
  invalid_password: "A senha inicial precisa ter ao menos 6 caracteres.",
  invalid_role: "Papel inválido. Use dono, admin ou vendedor.",
  missing_authorization: "Sessão expirada. Entre novamente para continuar.",
  missing_session: "Sessão expirada. Entre novamente para continuar.",
  owner_only_admin_creation: "Somente donos podem criar contas de administrador.",
  owner_only_role: "Somente donos podem criar outro dono.",
  self_delete_blocked: "Você não pode excluir sua própria conta por este fluxo.",
}

function translateManageUserError(code: string | undefined, message: string) {
  return code && MANAGE_USER_ERROR_MESSAGES[code] ? MANAGE_USER_ERROR_MESSAGES[code] : message
}

function normalizeErrorResponse(body: Partial<ManageUserErrorResponse>, fallback: string) {
  const code = typeof body.code === "string" ? body.code : undefined
  const message = typeof body.error === "string" && body.error ? body.error : fallback

  return new ManageUserRequestError(
    translateManageUserError(code, message),
    code
  )
}

export async function manageUser(payload: ManageUserPayload) {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.access_token) {
    throw new ManageUserRequestError(
      "Sessao expirada. Entre novamente para continuar.",
      "missing_session"
    )
  }

  const { data, error } = await supabase.functions.invoke<ManageUserResponse>("manage-user", {
    body: payload,
  })

  if (error) {
    const response = error.context instanceof Response ? error.context : null

    if (response) {
      try {
        const errorBody = (await response.json()) as Partial<ManageUserErrorResponse>
        throw normalizeErrorResponse(
          errorBody,
          "Não foi possível concluir a operação com a Edge Function."
        )
      } catch (parseError) {
        if (parseError instanceof ManageUserRequestError) {
          throw parseError
        }
      }
    }

    throw new ManageUserRequestError(
      error instanceof Error ? error.message : "Não foi possível chamar a Edge Function.",
      "request_failed"
    )
  }

  if (!data) {
    throw new ManageUserRequestError("A Edge Function respondeu sem dados.", "empty_response")
  }

  if (!data.success) {
    throw normalizeErrorResponse(data, data.error)
  }

  return data
}


