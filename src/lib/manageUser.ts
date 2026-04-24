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

export type ManageUserPayload =
  | CreateManagedUserPayload
  | DeleteManagedUserPayload

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

const manageUserUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`

function normalizeErrorResponse(body: Partial<ManageUserErrorResponse>, fallback: string) {
  return new ManageUserRequestError(
    typeof body.error === "string" && body.error ? body.error : fallback,
    typeof body.code === "string" ? body.code : undefined
  )
}

export async function manageUser(payload: ManageUserPayload) {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (!accessToken) {
    throw new ManageUserRequestError("Sessao expirada. Entre novamente para continuar.", "missing_session")
  }

  const response = await fetch(manageUserUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  })

  let data: ManageUserResponse | null = null

  try {
    data = (await response.json()) as ManageUserResponse
  } catch {
    if (!response.ok) {
      throw new ManageUserRequestError(
        "A Edge Function respondeu com erro sem corpo JSON.",
        "invalid_response"
      )
    }
  }

  if (!response.ok) {
    if (data && !data.success) {
      throw normalizeErrorResponse(data, "Não foi possível concluir a operação com a Edge Function.")
    }

    throw new ManageUserRequestError(
      "Não foi possível concluir a operação com a Edge Function.",
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
