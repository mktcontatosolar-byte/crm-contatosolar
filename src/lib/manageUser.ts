import { supabase } from "@/lib/supabase"

export type ManagedUserRole = "admin" | "corretor"

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

function normalizeErrorResponse(body: Partial<ManageUserErrorResponse>, fallback: string) {
  return new ManageUserRequestError(
    typeof body.error === "string" && body.error ? body.error : fallback,
    typeof body.code === "string" ? body.code : undefined
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
          "Nao foi possivel concluir a operacao com a Edge Function."
        )
      } catch (parseError) {
        if (parseError instanceof ManageUserRequestError) {
          throw parseError
        }
      }
    }

    throw new ManageUserRequestError(
      error instanceof Error ? error.message : "Nao foi possivel chamar a Edge Function.",
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
