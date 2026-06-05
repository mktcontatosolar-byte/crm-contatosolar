import { supabase } from "@/lib/supabase"
import type { CalculadoraConfig, CalculadoraInputs, CalculadoraResultados, CalculadoraSimulacao } from "@/types/calculadora"

export async function fetchCalculadoraConfig(): Promise<CalculadoraConfig> {
  const { data, error } = await supabase
    .from("calculadora_config")
    .select("*")
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Configuração da calculadora não encontrada.")
  return data as CalculadoraConfig
}

export async function updateCalculadoraConfig(
  id: string,
  patch: Omit<CalculadoraConfig, "id" | "updated_at">,
): Promise<CalculadoraConfig> {
  const { data, error } = await supabase
    .from("calculadora_config")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()

  if (error) throw error
  return data as CalculadoraConfig
}

export async function saveSimulacao(
  userId: string,
  nomeSimulacao: string,
  inputs: CalculadoraInputs,
  resultados: CalculadoraResultados,
): Promise<CalculadoraSimulacao> {
  const { data, error } = await supabase
    .from("calculadora_simulacoes")
    .insert({
      nome_simulacao: nomeSimulacao,
      criado_por: userId,
      ...inputs,
      ...resultados,
    })
    .select("*")
    .single()

  if (error) throw error
  return data as CalculadoraSimulacao
}

export async function fetchSimulacoes(): Promise<CalculadoraSimulacao[]> {
  const { data, error } = await supabase
    .from("calculadora_simulacoes")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(200)

  if (error) throw error
  const rows = (data ?? []) as CalculadoraSimulacao[]

  if (rows.length === 0) return []

  const sellerIds = [...new Set(rows.map((r) => r.criado_por))]
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nome, email")
    .in("id", sellerIds)

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      { nome: p.nome as string | null, email: p.email as string | null },
    ]),
  )

  return rows.map((row) => {
    const profile = profileMap.get(row.criado_por)
    return {
      ...row,
      criado_por_nome: profile?.nome ?? profile?.email ?? undefined,
    }
  })
}
