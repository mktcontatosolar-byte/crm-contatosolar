import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

type UserRole = "admin" | "corretor"

type CreateUserPayload = {
  action: "createUser"
  email: string
  password: string
  nome: string
  role: UserRole
  ativo: boolean
}

type DeleteUserPayload = {
  action: "deleteUser"
  userId: string
}

type ManageUserPayload = CreateUserPayload | DeleteUserPayload

const LEAD_STATE_TABLE = "crm_lead_state"

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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isValidRole(role: string): role is UserRole {
  return role === "admin" || role === "corretor"
}

async function findAuthUserByEmail(
  serviceClient: ReturnType<typeof createClient>,
  email: string
) {
  let page = 1

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    })

    if (error) {
      throw error
    }

    const matchedUser =
      data.users.find((user) => normalizeEmail(user.email ?? "") === email) ?? null

    if (matchedUser) {
      return matchedUser
    }

    if (!data.nextPage || data.users.length === 0) {
      return null
    }

    page = data.nextPage
  }
}

async function requireAdmin(request: Request) {
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
    .from("profiles")
    .select("id,role,ativo")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("Failed to load requester profile", profileError)
    return {
      ok: false as const,
      response: jsonResponse(500, {
        success: false,
        code: "profile_lookup_failed",
        error: "Could not validate requester permissions.",
      }),
    }
  }

  if (!profile || profile.role !== "admin" || !profile.ativo) {
    return {
      ok: false as const,
      response: jsonResponse(403, {
        success: false,
        code: "forbidden",
        error: "Only active admins can manage users.",
      }),
    }
  }

  return {
    ok: true as const,
    serviceClient,
    requesterId: user.id,
  }
}

async function handleCreateUser(
  serviceClient: ReturnType<typeof createClient>,
  payload: CreateUserPayload
) {
  const email = normalizeEmail(payload.email)
  const nome = payload.nome.trim()

  if (!email || !nome || !payload.password) {
    return jsonResponse(400, {
      success: false,
      code: "invalid_payload",
      error: "nome, email and password are required.",
    })
  }

  if (!isValidRole(payload.role)) {
    return jsonResponse(400, {
      success: false,
      code: "invalid_role",
      error: "role must be admin or corretor.",
    })
  }

  if (payload.password.length < 6) {
    return jsonResponse(400, {
      success: false,
      code: "invalid_password",
      error: "password must contain at least 6 characters.",
    })
  }

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      nome,
    },
  })

  let authUser = data?.user ?? null

  if (error || !authUser) {
    const errorMessage = (error?.message ?? "").toLowerCase()
    const isDuplicateEmail =
      errorMessage.includes("already") ||
      errorMessage.includes("registered") ||
      errorMessage.includes("exists")

    if (isDuplicateEmail) {
      try {
        authUser = await findAuthUserByEmail(serviceClient, email)
      } catch (lookupError) {
        console.error("Failed to recover existing auth user by email", lookupError)
      }
    }
  }

  if (!authUser) {
    return jsonResponse(400, {
      success: false,
      code: "auth_create_failed",
      error: error?.message ?? "Could not create user.",
    })
  }

  const { error: profileError } = await serviceClient.from("profiles").upsert(
    {
      id: authUser.id,
      email: authUser.email ?? email,
      nome,
      role: payload.role,
      ativo: payload.ativo,
    },
    { onConflict: "id" }
  )

  if (profileError) {
    console.error("Failed to upsert profile after auth create", profileError)

    if (data?.user?.id) {
      await serviceClient.auth.admin.deleteUser(data.user.id, false)
    }

    return jsonResponse(500, {
      success: false,
      code: "profile_upsert_failed",
      error: "User was not persisted safely. Creation was rolled back.",
    })
  }

  return jsonResponse(200, {
    success: true,
    action: "createUser",
    user: {
      id: authUser.id,
      email: authUser.email ?? email,
      nome,
      role: payload.role,
      ativo: payload.ativo,
    },
  })
}

async function handleDeleteUser(
  serviceClient: ReturnType<typeof createClient>,
  requesterId: string,
  payload: DeleteUserPayload
) {
  if (!payload.userId) {
    return jsonResponse(400, {
      success: false,
      code: "invalid_payload",
      error: "userId is required.",
    })
  }

  if (payload.userId === requesterId) {
    return jsonResponse(400, {
      success: false,
      code: "self_delete_blocked",
      error: "You cannot delete your own account from this flow.",
    })
  }

  const { count, error: leadsError } = await serviceClient
    .from(LEAD_STATE_TABLE)
    .select("lead_id", { count: "exact", head: true })
    .eq("corretor_id", payload.userId)
    .eq("arquivado", false)

  if (leadsError) {
    console.error("Failed to inspect assigned leads before deletion", leadsError)
    return jsonResponse(500, {
      success: false,
      code: "lead_check_failed",
      error: "Could not verify assigned leads before deletion.",
    })
  }

  if ((count ?? 0) > 0) {
    return jsonResponse(409, {
      success: false,
      code: "assigned_leads_block",
      error: "This user still has active leads assigned.",
    })
  }

  const warnings: string[] = []

  const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(
    payload.userId,
    false
  )

  if (authDeleteError) {
    return jsonResponse(400, {
      success: false,
      code: "auth_delete_failed",
      error: authDeleteError.message,
    })
  }

  const { error: profileDeleteError } = await serviceClient
    .from("profiles")
    .delete()
    .eq("id", payload.userId)

  if (profileDeleteError) {
    console.error("Profile cleanup failed after auth delete", profileDeleteError)
    warnings.push("Auth user deleted, but profile cleanup requires manual review.")
  }

  return jsonResponse(200, {
    success: true,
    action: "deleteUser",
    deletedUserId: payload.userId,
    warnings,
  })
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

  const adminResult = await requireAdmin(request)

  if (!adminResult.ok) {
    return adminResult.response
  }

  let payload: ManageUserPayload

  try {
    payload = (await request.json()) as ManageUserPayload
  } catch {
    return jsonResponse(400, {
      success: false,
      code: "invalid_json",
      error: "Request body must be valid JSON.",
    })
  }

  if (payload.action === "createUser") {
    return handleCreateUser(adminResult.serviceClient, payload)
  }

  if (payload.action === "deleteUser") {
    return handleDeleteUser(adminResult.serviceClient, adminResult.requesterId, payload)
  }

  return jsonResponse(400, {
    success: false,
    code: "unknown_action",
    error: "Supported actions are createUser and deleteUser.",
  })
})
