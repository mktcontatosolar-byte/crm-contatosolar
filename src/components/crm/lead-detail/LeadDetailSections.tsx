import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Download,
  Eye,
  FileImage,
  FileText,
  Home,
  MapPin,
  MessageSquareText,
  Pencil,
  Phone,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserCheck,
  UserRound,
} from "lucide-react"

import InfoField from "@/components/crm/InfoField"
import SectionCard from "@/components/crm/SectionCard"
import StatePanel from "@/components/crm/StatePanel"
import StatusBadge from "@/components/crm/StatusBadge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  getLeadAttachmentFriendlyTitle,
  getLeadAttachmentOriginLabel,
  getLeadAttachmentTypeLabel,
  isLeadAttachmentImage,
} from "@/lib/leadAttachments"
import { cn } from "@/lib/utils"
import type { ChatMessage, LeadActivity, LeadNote, Profile } from "@/types"
import type { LeadAttachment } from "@/types/leadAttachments"

type LeadAction = "return-pool" | "archive"
type LeadNoteWithAuthor = LeadNote & { authorProfile: Profile | null }

export type LeadViewModel = {
  telefone: string
  responsavel: string
  contaDeLuz: string
  cidade: string
  tipoImovel: string
  urgencia: string
  origem: string
  nome: string
  dataCriacao: string
  ultimaInteracao: string
  primeiroAtendimento: string | null
}

type HeaderBadge = {
  label: string
  tone?: "primary" | "accent" | "muted" | "outline"
  className: string
}

export function LeadHeaderCard({
  loading,
  pageTitle,
  createdAtLabel,
  initials,
  statusBadges,
  onBack,
}: {
  loading: boolean
  pageTitle: string
  createdAtLabel: string
  initials: string
  statusBadges: HeaderBadge[]
  onBack: () => void
}) {
  return (
    <SectionCard className="sticky top-4 z-10 bg-card/95 backdrop-blur" contentClassName="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <Button type="button" variant="outline" className="h-12 rounded-full px-4" onClick={onBack}>
            Voltar
          </Button>

          <Avatar size="lg" className="h-14 w-14">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-2">
            <p className="text-sm text-muted-foreground">{createdAtLabel}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{pageTitle}</h1>
            <div className="flex flex-wrap gap-2">
              {loading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-7 w-28 rounded-full" />
                  ))
                : statusBadges.map((badge) => (
                    <StatusBadge key={badge.label} tone={badge.tone} className={cn("text-sm", badge.className)}>
                      {badge.label}
                    </StatusBadge>
                  ))}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}

export function LeadCommercialInfoCard({
  leadView,
  emptyValue,
  whatsappUrl,
  onOpenWhatsApp,
}: {
  leadView: LeadViewModel
  emptyValue: string
  whatsappUrl: string | null
  onOpenWhatsApp: () => void
}) {
  return (
    <SectionCard
      title="Informações comerciais"
      description="Os dados que mais ajudam o vendedor a qualificar e priorizar este lead."
      actions={
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full"
          disabled={!whatsappUrl}
          onClick={onOpenWhatsApp}
        >
          <Phone className="mr-2 h-4 w-4" />
          Ir para WhatsApp
        </Button>
      }
      contentClassName="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      <InfoField icon={CircleDollarSign} label="Conta de luz" value={leadView.contaDeLuz || emptyValue} tone="highlight" />
      <InfoField icon={MapPin} label="Cidade" value={leadView.cidade || emptyValue} tone="highlight" />
      <InfoField icon={AlertTriangle} label="Urgência" value={leadView.urgencia || emptyValue} tone="highlight" />
      <InfoField icon={Home} label="Tipo de imóvel" value={leadView.tipoImovel || emptyValue} tone="highlight" />
    </SectionCard>
  )
}

export function LeadContactInfoCard({
  leadView,
  emptyValue,
}: {
  leadView: LeadViewModel
  emptyValue: string
}) {
  return (
    <SectionCard
      title="Contato e atendimento"
      description="Dados essenciais para contato e leitura rápida do atendimento."
      contentClassName="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      <InfoField icon={UserRound} label="Nome" value={leadView.nome || emptyValue} />
      <InfoField icon={Phone} label="Telefone" value={leadView.telefone || emptyValue} />
      <InfoField
        icon={UserCheck}
        label="Responsável pelo lead"
        value={<StatusBadge>{leadView.responsavel || emptyValue}</StatusBadge>}
      />
      <InfoField icon={MessageSquareText} label="Origem" value={leadView.origem || emptyValue} />
    </SectionCard>
  )
}

export function LeadDatesCard({
  leadView,
  emptyValue,
}: {
  leadView: LeadViewModel
  emptyValue: string
}) {
  return (
    <SectionCard title="Datas" contentClassName="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <InfoField
        icon={CalendarClock}
        label="Data de criação"
        value={leadView.dataCriacao || emptyValue}
        valueClassName="whitespace-pre-line"
      />
      <InfoField
        icon={CalendarClock}
        label="Última interação"
        value={leadView.ultimaInteracao || emptyValue}
        valueClassName="whitespace-pre-line"
      />
      {leadView.primeiroAtendimento ? (
        <InfoField
          icon={Clock3}
          label="Primeiro atendimento"
          value={leadView.primeiroAtendimento}
          valueClassName="whitespace-pre-line"
        />
      ) : null}
    </SectionCard>
  )
}

export function LeadAttachmentsCard({
  attachments,
  loading,
  errorMessage,
  uploadErrorMessage,
  uploading,
  previewingAttachmentId,
  downloadingAttachmentId,
  onUploadAttachment,
  onViewAttachment,
  onDownloadAttachment,
  formatDateTime,
}: {
  attachments: LeadAttachment[]
  loading: boolean
  errorMessage: string | null
  uploadErrorMessage: string | null
  uploading: boolean
  previewingAttachmentId: string | null
  downloadingAttachmentId: string | null
  onUploadAttachment: () => void
  onViewAttachment: (attachment: LeadAttachment) => void
  onDownloadAttachment: (attachment: LeadAttachment) => void
  formatDateTime: (value: string | null | undefined) => string
}) {
  return (
    <SectionCard
      title="Conta de energia"
      description="Arquivos enviados pelo lead com acesso privado."
      actions={
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full"
          disabled={loading || uploading}
          onClick={onUploadAttachment}
        >
          {uploading
            ? "Anexando..."
            : attachments.length === 0
              ? "Anexar conta"
              : "Anexar nova conta"}
        </Button>
      }
      contentClassName="space-y-3"
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-3xl" />
          ))}
        </div>
      ) : errorMessage ? (
        <StatePanel tone="warning" centered={false}>
          {errorMessage}
        </StatePanel>
      ) : (
        <div className="space-y-3">
          {uploadErrorMessage ? (
            <StatePanel tone="warning" centered={false}>
              {uploadErrorMessage}
            </StatePanel>
          ) : null}

          {attachments.length === 0 ? (
            <StatePanel centered={false}>Nenhuma conta de energia anexada ainda.</StatePanel>
          ) : null}

          {attachments.map((attachment) => {
            const PreviewIcon = isLeadAttachmentImage(attachment) ? FileImage : FileText
            const title = getLeadAttachmentFriendlyTitle(attachment)
            const subtitle = `Enviada em ${formatDateTime(attachment.created_at)}`

            return (
              <div
                key={attachment.id}
                className="rounded-3xl border border-border/60 bg-background/70 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl border border-border/60 bg-card/90 p-3">
                        <PreviewIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <p className="text-sm font-medium text-foreground">{title}</p>
                        <p className="text-sm text-muted-foreground">{subtitle}</p>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge>Origem: {getLeadAttachmentOriginLabel(attachment.origem)}</StatusBadge>
                          <StatusBadge>Tipo: {getLeadAttachmentTypeLabel(attachment)}</StatusBadge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-full"
                      disabled={previewingAttachmentId === attachment.id || downloadingAttachmentId === attachment.id}
                      onClick={() => onViewAttachment(attachment)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      {previewingAttachmentId === attachment.id ? "Abrindo..." : "Visualizar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-full"
                      disabled={previewingAttachmentId === attachment.id || downloadingAttachmentId === attachment.id}
                      onClick={() => onDownloadAttachment(attachment)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {downloadingAttachmentId === attachment.id ? "Preparando..." : "Baixar"}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}

export function LeadActionsPanel({
  updating,
  pendingAction,
  onSelectAction,
}: {
  updating: boolean
  pendingAction: LeadAction | null
  onSelectAction: (action: LeadAction) => void
}) {
  const actionItems: Array<{
    key: LeadAction
    title: string
    description: string
    buttonLabel: string
    icon: typeof Archive
    tone?: "default" | "highlight"
  }> = [
    {
      key: "return-pool",
      title: "Voltar para a fila",
      description: "Esse lead sai da carteira atual e volta para a fila de distribuição.",
      buttonLabel: "Voltar para a fila",
      icon: RotateCcw,
    },
    {
      key: "archive",
      title: "Encerramento",
      description: "Arquiva o lead e remove este atendimento das filas operacionais ativas.",
      buttonLabel: "Arquivar",
      icon: Archive,
      tone: "highlight",
    },
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {actionItems.map((item) => {
        const Icon = item.icon
        return (
          <SectionCard
            key={item.key}
            tone={item.tone}
            contentClassName="px-0 pb-0"
            className="overflow-hidden"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-2.5">
                  <Icon className={cn("h-4 w-4", item.tone === "highlight" ? "text-accent" : "text-primary")} />
                </div>
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardFooter>
              <Button
                type="button"
                className="h-12 w-full rounded-full"
                variant="outline"
                disabled={updating}
                onClick={() => onSelectAction(item.key)}
              >
                {updating && pendingAction === item.key ? "Processando..." : item.buttonLabel}
              </Button>
            </CardFooter>
          </SectionCard>
        )
      })}
    </div>
  )
}

export function LeadNotesPanel({
  notes,
  canAddNote,
  canManageNote,
  editingNoteId,
  editingNoteContent,
  newNote,
  savingNote,
  updateNotePending,
  deleteNotePending,
  setEditingNoteContent,
  setNewNote,
  startEditingNote,
  cancelEditingNote,
  requestDeleteNote,
  saveEditedNote,
  saveNote,
  formatDateTime,
}: {
  notes: LeadNoteWithAuthor[]
  canAddNote: boolean
  canManageNote: (note: LeadNoteWithAuthor) => boolean
  editingNoteId: string | null
  editingNoteContent: string
  newNote: string
  savingNote: boolean
  updateNotePending: boolean
  deleteNotePending: boolean
  setEditingNoteContent: (value: string) => void
  setNewNote: (value: string) => void
  startEditingNote: (note: LeadNoteWithAuthor) => void
  cancelEditingNote: () => void
  requestDeleteNote: (note: LeadNoteWithAuthor) => void
  saveEditedNote: (payload: { noteId: string; content: string }) => void
  saveNote: () => void
  formatDateTime: (value: string | null | undefined) => string
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard
        title="Observações internas"
        description="Essas anotações são vistas apenas pela equipe."
      >
        {notes.length === 0 ? (
          <StatePanel centered={false}>Nenhuma nota interna ainda.</StatePanel>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {note.authorProfile?.nome || note.authorProfile?.email || "Autor desconhecido"}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatDateTime(note.created_at)}</p>
                  </div>

                  {canManageNote(note) ? (
                    <div className="flex items-center gap-2 self-end sm:self-start">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-10 w-10 rounded-full"
                        disabled={updateNotePending || deleteNotePending}
                        onClick={() => startEditingNote(note)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar nota</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-10 w-10 rounded-full text-destructive hover:text-destructive"
                        disabled={updateNotePending || deleteNotePending}
                        onClick={() => requestDeleteNote(note)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Excluir nota</span>
                      </Button>
                    </div>
                  ) : null}
                </div>

                {editingNoteId === note.id ? (
                  <div className="mt-3 space-y-3">
                    <Textarea
                      value={editingNoteContent}
                      onChange={(event) => setEditingNoteContent(event.target.value)}
                      className="min-h-32 rounded-2xl text-sm"
                      disabled={updateNotePending}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        className="h-12 rounded-full sm:w-auto"
                        disabled={updateNotePending || editingNoteContent.trim().length === 0}
                        onClick={() =>
                          saveEditedNote({
                            noteId: note.id,
                            content: editingNoteContent.trim(),
                          })
                        }
                      >
                        {updateNotePending ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-full sm:w-auto"
                        disabled={updateNotePending}
                        onClick={cancelEditingNote}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                    {note.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Nova nota"
        description={
          canAddNote
            ? "Registre um contexto interno para o time."
            : "Somente admin ou o vendedor responsável podem adicionar notas."
        }
        tone="highlight"
        contentClassName="space-y-4"
      >
        <Textarea
          value={newNote}
          disabled={!canAddNote || savingNote}
          placeholder={
            canAddNote
              ? "Escreva uma observação sobre este lead"
              : "Você não pode registrar observações neste lead"
          }
          onChange={(event) => setNewNote(event.target.value)}
          className="min-h-40 rounded-2xl text-sm"
        />
        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>As notas ficam visíveis apenas para a equipe.</span>
          <span>{newNote.trim().length} caractere(s)</span>
        </div>
        <Button
          type="button"
          className="h-12 w-full rounded-full"
          disabled={!canAddNote || savingNote || newNote.trim().length === 0}
          onClick={saveNote}
        >
          {savingNote ? "Salvando..." : "Salvar nota"}
        </Button>
      </SectionCard>
    </div>
  )
}

export function LeadConversationPanel({
  activities,
  activityLoading,
  activityIcon,
  activityUserName,
  formatRelativeTime,
  formatTimeOnly,
  messages,
}: {
  activities: LeadActivity[]
  activityLoading: boolean
  activityIcon: (activity: LeadActivity) => typeof RefreshCw
  activityUserName: (activity: LeadActivity) => string
  formatRelativeTime: (value: string | null | undefined) => string
  formatTimeOnly: (value: string | null | undefined) => string
  messages: ChatMessage[]
}) {
  return (
    <SectionCard
      title="Conversa"
      description="Atividades operacionais e histórico de mensagens deste lead."
      contentClassName="space-y-6"
    >
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Ações realizadas</h3>
          <p className="text-sm text-muted-foreground">Tudo o que foi alterado neste lead pela operação.</p>
        </div>

        {activityLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <StatePanel centered={false}>Ainda não houve movimentações nesse lead.</StatePanel>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const Icon = activityIcon(activity)
              return (
                <div key={activity.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-border/60 bg-card/90 p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{activity.descricao}</p>
                      <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                        <span>{activityUserName(activity)}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{formatRelativeTime(activity.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Mensagens trocadas</h3>
        </div>

        {messages.length === 0 ? (
          <StatePanel centered={false}>Ainda não há mensagens registradas para esse lead.</StatePanel>
        ) : (
          <div className="max-h-[500px] space-y-4 overflow-y-auto rounded-[2rem] border border-border/60 bg-muted/35 p-4 sm:p-5">
            {messages.map((message) => {
              const isUserMessage = message.role === "user"

              return (
                <div
                  key={message.id}
                  className={cn("flex w-full", isUserMessage ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "flex max-w-[88%] items-end gap-3 sm:max-w-[75%]",
                      isUserMessage ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {!isUserMessage ? (
                      <Avatar size="sm" className="mt-1 h-8 w-8 border border-border/60 bg-card/90">
                        <AvatarFallback className="bg-card text-[11px] font-semibold text-foreground">
                          Bot
                        </AvatarFallback>
                      </Avatar>
                    ) : null}

                    <div
                      className={cn(
                        "rounded-[1.5rem] px-4 py-3 shadow-sm",
                        isUserMessage
                          ? "rounded-br-md bg-[color:color-mix(in_oklab,var(--primary)_48%,black)] text-white"
                          : "rounded-bl-md border border-border/60 bg-[color:color-mix(in_oklab,var(--card)_72%,black)] text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                      <p
                        className={cn(
                          "mt-2 text-[11px]",
                          isUserMessage ? "text-white/78" : "text-muted-foreground"
                        )}
                      >
                        {formatTimeOnly(message.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SectionCard>
  )
}


