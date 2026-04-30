import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Archive, Clock3, Mail, MessageSquareText, Phone, UserRound, X } from "lucide-react"
import StatePanel from "@/components/crm/StatePanel"
import StatusBadge from "@/components/crm/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/useAuth"
import { formatCrmDateTime } from "@/lib/dateTime"
import { fetchLeadAttachments } from "@/lib/leadAttachments"
import { supabase } from "@/lib/supabase"
import type { ChatMessage, LeadDetail, LeadNote, Profile } from "@/types"
import { toast } from "sonner"

type LeadSummary = Pick<
  LeadDetail,
  | "id"
  | "nome_completo"
  | "email"
  | "telefone_contato"
  | "horario_preferido"
  | "status_conversa"
  | "corretor_id"
  | "created_at"
  | "assumed_at"
  | "outra_info"
  | "origem"
  | "campanha"
>

type LeadDetailModalProps = {
  lead: LeadSummary
  onClose: () => void
  onLeadUpdated: (leadId: string, action: "refresh" | "remove") => void
}

function leadDisplayName(lead: LeadSummary | LeadDetail) {
  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificação"
}

function DetailItem({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-[1.25rem] border border-border/60 bg-background/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span>{label}</span>
      </div>
      <p className="break-words text-sm leading-6 text-foreground">{value}</p>
    </div>
  )
}

export default function LeadDetailModal({
  lead,
  onClose,
  onLeadUpdated,
}: LeadDetailModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const { isAdmin, user } = useAuth()
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null)
  const [assignedBroker, setAssignedBroker] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [notes, setNotes] = useState<Array<LeadNote & { authorProfile: Profile | null }>>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [error, setError] = useState("")
  const [hasEnergyAttachment, setHasEnergyAttachment] = useState(false)

  const canAddNote = Boolean(
    user &&
      leadDetail &&
      (isAdmin || (leadDetail.corretor_id !== null && leadDetail.corretor_id === user.id))
  )

  const detailSelect =
    "id,nome_completo,email,telefone_contato,horario_preferido,status_conversa,corretor_id,assumed_at,stage_id,arquivado,ia_paused,campanha,origem,outra_info,created_at,first_response_at,last_interaction_at"

  const loadNotes = useCallback(async () => {
    const { data: notesData, error: notesError } = await supabase
      .from("lead_notes")
      .select("id,lead_id,author_id,content,created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })

    if (notesError) {
      throw notesError
    }

    const fetchedNotes = (notesData ?? []) as LeadNote[]
    const authorIds = [...new Set(fetchedNotes.map((note) => note.author_id))]

    if (authorIds.length === 0) {
      setNotes([])
      return
    }

    const { data: authorsData, error: authorsError } = await supabase
      .from("profiles")
      .select("id,nome,email")
      .in("id", authorIds)

    if (authorsError) {
      throw authorsError
    }

    const authorsById = new Map(
      ((authorsData ?? []) as Profile[]).map((profile) => [profile.id, profile])
    )

    setNotes(
      fetchedNotes.map((note) => ({
        ...note,
        authorProfile: authorsById.get(note.author_id) ?? null,
      }))
    )
  }, [lead.id])

  const loadDetails = useCallback(async () => {
    try {
      setLoading(true)

      const { data: leadData, error: leadError } = await supabase
        .from("leads_lancamento")
        .select(detailSelect)
        .eq("id", lead.id)
        .maybeSingle()

      if (leadError) {
        throw leadError
      }

      if (!leadData) {
        setError("Lead não encontrado.")
        setLeadDetail(null)
        setAssignedBroker(null)
        setHasEnergyAttachment(false)
        setMessages([])
        return
      }

      const detail = leadData as LeadDetail
      setLeadDetail(detail)

      const attachmentMatches = await fetchLeadAttachments({
        id: detail.id,
        remotejid: detail.remotejid,
        telefone_confirmado: detail.telefone_confirmado,
        numero: detail.numero ?? detail.telefone_contato,
      })
      setHasEnergyAttachment(attachmentMatches.length > 0)

      const messagesPromise = supabase
        .from("chat_history")
        .select("id,lead_id,role,content,created_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: true })

      const brokerPromise = detail.corretor_id
        ? supabase.from("profiles").select("id,nome,email").eq("id", detail.corretor_id).maybeSingle()
        : Promise.resolve({ data: null, error: null })

      const [messagesResult, brokerResult] = await Promise.all([messagesPromise, brokerPromise])

      if (messagesResult.error) {
        throw messagesResult.error
      }

      if (brokerResult.error) {
        throw brokerResult.error
      }

      setMessages((messagesResult.data ?? []) as ChatMessage[])
      setAssignedBroker((brokerResult.data as Profile | null) ?? null)
      await loadNotes()
      setError("")
    } catch (loadError) {
      console.error("Erro ao carregar detalhe do lead:", loadError)
      setError("Não foi possível carregar os detalhes do lead.")
    } finally {
      setLoading(false)
    }
  }, [detailSelect, lead.id, loadNotes])

  async function updateLead(
    values: Partial<Pick<LeadDetail, "ia_paused" | "arquivado" | "corretor_id" | "assumed_at" | "stage_id">>,
    action: "refresh" | "remove"
  ) {
    try {
      setUpdating(true)

      const { error: updateError } = await supabase
        .from("leads_lancamento")
        .update(values)
        .eq("id", lead.id)

      if (updateError) {
        throw updateError
      }

      onLeadUpdated(lead.id, action)

      if (action === "remove") {
        toast.success("Lead atualizado com sucesso.")
        onClose()
        return
      }

      await loadDetails()
      toast.success("Lead atualizado com sucesso.")
    } catch (updateError) {
      console.error("Erro ao atualizar lead:", updateError)
      setError("Não foi possível atualizar o lead.")
      toast.error("Não foi possível atualizar o lead.")
    } finally {
      setUpdating(false)
    }
  }

  async function saveNote() {
    if (!user || !canAddNote) {
      setError("Você não tem permissão para adicionar nota neste lead.")
      return
    }

    const content = newNote.trim()
    if (!content) {
      return
    }

    try {
      setSavingNote(true)

      const { error: insertError } = await supabase.from("lead_notes").insert({
        lead_id: lead.id,
        author_id: user.id,
        content,
      })

      if (insertError) {
        throw insertError
      }

      setNewNote("")
      await loadNotes()
      setError("")
      toast.success("Nota interna salva com sucesso.")
    } catch (saveError) {
      console.error("Erro ao salvar nota interna:", saveError)
      setError("Não foi possível salvar a nota interna.")
      toast.error("Não foi possível salvar a nota interna.")
    } finally {
      setSavingNote(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDetails()
    }, 0)

    const channel = supabase
      .channel(`lead-detail-${lead.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads_lancamento", filter: `id=eq.${lead.id}` },
        () => {
          void loadDetails()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_history", filter: `lead_id=eq.${lead.id}` },
        () => {
          void loadDetails()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_notes", filter: `lead_id=eq.${lead.id}` },
        () => {
          void loadDetails()
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(timeoutId)
      void supabase.removeChannel(channel)
    }
  }, [lead.id, loadDetails])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => {
      window.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  useEffect(() => {
    closeButtonRef.current?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      aria-hidden="true"
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden border border-border/60 bg-card/95 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader className="border-b border-border/60 bg-card/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="crm-badge-brand inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium">
                  Atendimento
                </span>
                {hasEnergyAttachment ? <StatusBadge tone="accent" className="text-white">Conta recebida</StatusBadge> : null}
              </div>
              <div className="space-y-2">
                <CardTitle id={titleId} className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                  {leadDisplayName(leadDetail ?? lead)}
                </CardTitle>
                <CardDescription id={descriptionId} className="max-w-2xl text-sm leading-6">
                  Visão centralizada do lead, histórico de conversa, observações internas e ações operacionais.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                ref={closeButtonRef}
                type="button"
                variant="ghost"
                size="icon-sm"
                className="self-end rounded-2xl"
                aria-label="Fechar detalhes do lead"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.25rem] border border-border/60 bg-background/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {leadDetail?.status_conversa || lead.status_conversa}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/60 bg-background/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Conta de energia</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {hasEnergyAttachment ? "Conta recebida" : "Ainda não enviada"}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border/60 bg-background/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Arquivamento</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {leadDetail?.arquivado ? "Arquivado" : "Em atendimento"}
                </p>
              </div>
            </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto">
          {loading ? (
            <StatePanel>Carregando detalhes do lead...</StatePanel>
          ) : null}

          {!loading && error ? (
            <StatePanel tone="error" centered={false}>{error}</StatePanel>
          ) : null}

          {!loading && leadDetail ? (
            <div className="space-y-8">
              <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4 rounded-[1.75rem] border border-border/60 bg-muted/25 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Dados do lead</h2>
                      <p className="text-sm text-muted-foreground">Informações principais para atendimento.</p>
                    </div>
                    <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                      {assignedBroker?.nome || assignedBroker?.email || "Sem vendedor"}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailItem label="Nome" value={leadDetail.nome_completo || "Não informado"} icon={UserRound} />
                    <DetailItem label="E-mail" value={leadDetail.email || "Não informado"} icon={Mail} />
                    <DetailItem label="Telefone" value={leadDetail.telefone_contato || "Não informado"} icon={Phone} />
                    <DetailItem
                      label="Horario preferido"
                      value={leadDetail.horario_preferido || "Não informado"}
                      icon={Clock3}
                    />
                    <DetailItem
                      label="Status da conversa"
                      value={leadDetail.status_conversa || "Não informado"}
                      icon={MessageSquareText}
                    />
                    <DetailItem
                      label="Responsável pelo lead"
                      value={assignedBroker?.nome || assignedBroker?.email || "Nenhum vendedor atribuído"}
                      icon={UserRound}
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-[1.75rem] border border-border/60 bg-muted/25 p-4 sm:p-5">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Contexto comercial</h2>
                    <p className="text-sm text-muted-foreground">Origem, campanha e datas relevantes.</p>
                  </div>

                  <div className="grid gap-3">
                    <DetailItem label="Origem" value={leadDetail.origem || "Não informada"} />
                    <DetailItem label="Campanha" value={leadDetail.campanha || "Não informada"} />
                    <DetailItem label="Outra info" value={leadDetail.outra_info || "Não informada"} />
                    <DetailItem label="Data de criação" value={formatCrmDateTime(leadDetail.created_at, "Não disponível")} icon={Clock3} />
                    <DetailItem label="Data de qualificação" value="Não disponível na tabela atual" />
                    <DetailItem
                      label="Última interação"
                      value={formatCrmDateTime(leadDetail.last_interaction_at, "Não disponível")}
                      icon={Clock3}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-border/60 bg-muted/25 p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Ações operacionais</h2>
                    <p className="text-sm text-muted-foreground">Controles rápidos de atendimento e funil.</p>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-border/60 bg-background/70 p-4">
                    <p className="text-sm font-medium text-foreground">Voltar para a fila</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Remove a atribuição atual e devolve o lead para a fila inicial.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full rounded-3xl"
                      disabled={updating}
                      onClick={() =>
                        void updateLead(
                          {
                            corretor_id: null,
                            assumed_at: null,
                            stage_id: null,
                          },
                          "refresh"
                        )
                      }
                    >
                      Voltar para a fila
                    </Button>
                  </div>

                  <div className="rounded-[1.5rem] border border-[color:color-mix(in_oklab,var(--accent)_24%,transparent)] bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)] p-4">
                    <p className="text-sm font-medium text-foreground">Encerramento</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Arquiva o lead e remove este atendimento das filas operacionais ativas.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full rounded-3xl border-[color:color-mix(in_oklab,var(--accent)_24%,transparent)] bg-background/80"
                      disabled={updating}
                      onClick={() => void updateLead({ arquivado: true }, "remove")}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Arquivar
                    </Button>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-3 rounded-[1.75rem] border border-border/60 bg-muted/25 p-4 sm:p-5">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Notas internas</h2>
                    <p className="text-sm text-muted-foreground">
                      Observações visíveis apenas para a equipe.
                    </p>
                  </div>

                {notes.length === 0 ? (
                  <StatePanel>Nenhuma nota interna ainda.</StatePanel>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-[1.5rem] border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground"
                      >
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <span className="font-medium text-foreground">
                            {note.authorProfile?.nome ||
                              note.authorProfile?.email ||
                              "Autor desconhecido"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatCrmDateTime(note.created_at, "Não disponível")}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words leading-6">{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 rounded-[1.5rem] border border-border/60 bg-background/60 p-4">
                  <label className="text-sm font-medium text-foreground" htmlFor="lead-note-content">
                    Nova nota interna
                  </label>
                  <Textarea
                    id="lead-note-content"
                    placeholder={
                      canAddNote
                        ? "Escreva uma observação interna sobre este lead"
                        : "Somente admin ou o vendedor responsável podem adicionar notas"
                    }
                    value={newNote}
                    disabled={!canAddNote || savingNote}
                    onChange={(event) => setNewNote(event.target.value)}
                  />
                  <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {canAddNote
                        ? "Notas ficam visíveis apenas para a equipe."
                        : "Você precisa ser admin ou vendedor responsável para registrar notas."}
                    </span>
                    <span>{newNote.trim().length} caractere(s)</span>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      disabled={!canAddNote || savingNote || newNote.trim().length === 0}
                      onClick={() => void saveNote()}
                    >
                      {savingNote ? "Salvando..." : "Salvar nota"}
                    </Button>
                  </div>
                </div>
                </div>

                <div className="space-y-3 rounded-[1.75rem] border border-border/60 bg-muted/25 p-4 sm:p-5">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Mensagens trocadas</h2>
                    <p className="text-sm text-muted-foreground">
                      Registros completos da tabela chat_history para este lead.
                    </p>
                  </div>

                  {messages.length === 0 ? (
                    <StatePanel>Nenhuma conversa registrada ainda.</StatePanel>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className="rounded-[1.5rem] border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground"
                        >
                          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="inline-flex w-fit rounded-full border border-border/60 bg-card px-3 py-1 font-medium capitalize text-foreground">
                              {message.role}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatCrmDateTime(message.created_at, "Não disponível")}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap break-words leading-6">{message.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}


