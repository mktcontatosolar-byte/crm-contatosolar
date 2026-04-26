import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { ManualLeadInput } from "@/lib/crmLeads"

type ManualLeadFormState = {
  nome: string
  telefone: string
  email: string
  horario_preferido: string
  cidade: string
  tipoimovel: string
  valorcontaenergia: string
  urgencia: string
  telefone_confirmado: string
  origem: string
  outra_info: string
  conta: "unknown" | "true" | "false"
}

const initialFormState: ManualLeadFormState = {
  nome: "",
  telefone: "",
  email: "",
  horario_preferido: "",
  cidade: "",
  tipoimovel: "",
  valorcontaenergia: "",
  urgencia: "",
  telefone_confirmado: "",
  origem: "",
  outra_info: "",
  conta: "unknown",
}

function trimOrNull(value: string) {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function FieldGroup({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4 rounded-[1.75rem] border border-border/60 bg-background/50 p-4 sm:p-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export default function ManualLeadForm({
  onSubmit,
  isSubmitting,
  onCancel,
  submitLabel = "Salvar lead",
}: {
  onSubmit: (values: ManualLeadInput) => Promise<void>
  isSubmitting: boolean
  onCancel: () => void
  submitLabel?: string
}) {
  const [form, setForm] = useState<ManualLeadFormState>(initialFormState)
  const [error, setError] = useState("")

  const canSubmit = useMemo(() => {
    return Boolean(form.nome.trim() || form.telefone.trim() || form.email.trim())
  }, [form.email, form.nome, form.telefone])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit) {
      setError("Preencha pelo menos nome, telefone ou e-mail.")
      return
    }

    setError("")

    await onSubmit({
      nome: trimOrNull(form.nome),
      telefone: trimOrNull(form.telefone),
      email: trimOrNull(form.email),
      horario_preferido: trimOrNull(form.horario_preferido),
      cidade: trimOrNull(form.cidade),
      tipoimovel: trimOrNull(form.tipoimovel),
      valorcontaenergia: trimOrNull(form.valorcontaenergia),
      outra_info: trimOrNull(form.outra_info),
      conta: form.conta === "unknown" ? null : form.conta === "true",
      urgencia: trimOrNull(form.urgencia),
      telefone_confirmado: trimOrNull(form.telefone_confirmado),
      origem: trimOrNull(form.origem),
      campanha: null,
    })
  }

  function updateField<K extends keyof ManualLeadFormState>(field: K, value: ManualLeadFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FieldGroup
        title="Contato principal"
        description="Preencha o básico para o lead entrar no atendimento sem depender de campanha."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="manual-lead-nome">Nome</Label>
            <Input
              id="manual-lead-nome"
              value={form.nome}
              onChange={(event) => updateField("nome", event.target.value)}
              placeholder="Nome do contato"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-lead-telefone">Telefone</Label>
            <Input
              id="manual-lead-telefone"
              value={form.telefone}
              onChange={(event) => updateField("telefone", event.target.value)}
              placeholder="(11) 99999-9999"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="manual-lead-email">E-mail</Label>
            <Input
              id="manual-lead-email"
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="contato@empresa.com"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </FieldGroup>

      <FieldGroup
        title="Detalhes do atendimento"
        description="Esses dados ajudam na qualificação, mas podem ficar vazios sem quebrar o CRM."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="manual-lead-horario">Horário Preferido de atendimento</Label>
            <Input
              id="manual-lead-horario"
              value={form.horario_preferido}
              onChange={(event) => updateField("horario_preferido", event.target.value)}
              placeholder="Manhã, tarde, noite..."
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-lead-cidade">Cidade</Label>
            <Input
              id="manual-lead-cidade"
              value={form.cidade}
              onChange={(event) => updateField("cidade", event.target.value)}
              placeholder="Cidade"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-lead-tipo-imovel">Tipo de imóvel</Label>
            <Input
              id="manual-lead-tipo-imovel"
              value={form.tipoimovel}
              onChange={(event) => updateField("tipoimovel", event.target.value)}
              placeholder="Casa, apartamento, comércio..."
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-lead-conta-energia">Valor da conta de energia</Label>
            <Input
              id="manual-lead-conta-energia"
              value={form.valorcontaenergia}
              onChange={(event) => updateField("valorcontaenergia", event.target.value)}
              placeholder="Ex: R$ 450"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-lead-urgencia">Urgência</Label>
            <Input
              id="manual-lead-urgencia"
              value={form.urgencia}
              onChange={(event) => updateField("urgencia", event.target.value)}
              placeholder="Alta, média, baixa..."
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-lead-origem">Origem comercial</Label>
            <Input
              id="manual-lead-origem"
              value={form.origem}
              onChange={(event) => updateField("origem", event.target.value)}
              placeholder="Indicação, site, evento..."
              disabled={isSubmitting}
            />
          </div>
        </div>
      </FieldGroup>

      <FieldGroup
        title="Confirmações"
        description="Use apenas se essas informações já estiverem validadas no atendimento."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="manual-lead-telefone-confirmado">Telefone confirmado</Label>
            <Select
              id="manual-lead-telefone-confirmado"
              value={form.telefone_confirmado}
              onChange={(event) => updateField("telefone_confirmado", event.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Não informar</option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-lead-conta">Conta enviada</Label>
            <Select
              id="manual-lead-conta"
              value={form.conta}
              onChange={(event) => updateField("conta", event.target.value as ManualLeadFormState["conta"])}
              disabled={isSubmitting}
            >
              <option value="unknown">Não informar</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </Select>
          </div>
        </div>
      </FieldGroup>

      <FieldGroup
        title="Contexto adicional"
        description="Anote detalhes úteis para o vendedor continuar o atendimento sem perder contexto."
      >
        <div className="space-y-2">
          <Label htmlFor="manual-lead-outra-info">Outras informações</Label>
          <Textarea
            id="manual-lead-outra-info"
            value={form.outra_info}
            onChange={(event) => updateField("outra_info", event.target.value)}
            placeholder="Anote qualquer contexto útil para o atendimento"
            className="min-h-48 rounded-2xl"
            disabled={isSubmitting}
          />
        </div>
      </FieldGroup>

      {error ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-12 rounded-full" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" className="h-12 rounded-full" disabled={isSubmitting || !canSubmit}>
          {isSubmitting ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}
