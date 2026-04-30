import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import StatePanel from "@/components/crm/StatePanel"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/useAuth"
import {
  fetchLeadById,
  fetchLeadMessagesByIdentifiers,
  LEAD_MESSAGES_TABLE,
  LEAD_NOTES_TABLE,
  LEAD_SOURCE_TABLE,
  LEAD_STATE_TABLE,
  updateLeadState,
} from "@/lib/crmLeads"
import { logAuditEvent } from "@/lib/auditLogs"
import {
  createLeadAttachmentSignedUrl,
  fetchLeadAttachments,
  getLeadAttachmentErrorMessage,
  getLeadAttachmentFriendlyTitle,
  hasActiveEnergyAttachment,
  isLeadAttachmentImage,
  isLeadAttachmentPdf,
  uploadLeadAttachmentFromFile,
} from "@/lib/leadAttachments"
import { fetchLeadActivities, safeLogLeadActivity } from "@/lib/leadActivity"
import { notifyLeadAssignment } from "@/lib/leadAssignmentNotifications"
import { supabase } from "@/lib/supabase"
import type { ChatMessage, LeadDetail, LeadNote, Profile } from "@/types"
import type { LeadAttachment } from "@/types/leadAttachments"
import {
  LeadActionConfirmDialog,
  LeadAttachmentPreviewDialog,
  LeadNoteDeleteDialog,
} from "@/components/crm/lead-detail/LeadDetailDialogs"
import { LeadDetailHeader } from "@/components/crm/lead-detail/LeadDetailHeader"
import { LeadDetailTabs } from "@/components/crm/lead-detail/LeadDetailTabs"
import { LeadDataTab } from "@/components/crm/lead-detail/LeadDataTab"
import { LeadActionsTab } from "@/components/crm/lead-detail/LeadActionsTab"
import { LeadNotesTab } from "@/components/crm/lead-detail/LeadNotesTab"
import { LeadConversationTab } from "@/components/crm/lead-detail/LeadConversationTab"
import { useLeadDetailDialogs } from "@/components/crm/lead-detail/useLeadDetailDialogs"
import { useLeadAttachmentUiState } from "@/components/crm/lead-detail/useLeadAttachmentUiState"
import { useLeadNoteEditing } from "@/components/crm/lead-detail/useLeadNoteEditing"
import {
  activityIcon,
  activityUserName,
  buildLeadStatusBadges,
  buildLeadView,
  EMPTY_VALUE,
  formatDateTime,
  formatRelativeTime,
  formatTimeOnly,
  getInitials,
  getLeadSessionId,
  getSupabaseErrorMessage,
  getWhatsAppUrl,
  leadDisplayName,
  mapN8nMessages,
} from "@/components/crm/lead-detail/leadDetailViewModel"

type LeadAction = "return-pool" | "archive"
type LeadNoteWithAuthor = LeadNote & { authorProfile: Profile | null }
function TabPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
      <CardContent className="space-y-4 p-5 lg:p-6">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-2xl" />
        ))}
      </CardContent>
    </Card>
  )
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin, user } = useAuth()
  const [activeTab, setActiveTab] = useState("dados")
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null)
  const [assignedBroker, setAssignedBroker] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [error, setError] = useState("")

  const {
    pendingAction,
    pendingDeleteNote,
    openActionDialog,
    closeActionDialog,
    openNoteDeleteDialog,
    closeNoteDeleteDialog,
  } = useLeadDetailDialogs<LeadAction, LeadNoteWithAuthor>()

  const {
    selectedAttachment,
    previewingAttachmentId,
    downloadingAttachmentId,
    attachmentPreviewUrl,
    attachmentPreviewLoading,
    attachmentPreviewError,
    attachmentUploadError,
    uploadingAttachment,
    setAttachmentPreviewUrl,
    setAttachmentPreviewError,
    setAttachmentUploadError,
    setUploadingAttachment,
    openAttachmentPreview: openAttachmentPreviewUi,
    closeAttachmentPreview: closeAttachmentPreviewUi,
    startAttachmentPreviewRequest,
    finishAttachmentPreviewRequest,
    startAttachmentDownload,
    finishAttachmentDownload,
    clearAttachmentUploadError,
  } = useLeadAttachmentUiState<LeadAttachment>()

  const {
    editingNoteId,
    editingNoteContent,
    setEditingNoteContent,
    startEditingNote,
    cancelEditingNote,
    resetEditingNote,
  } = useLeadNoteEditing<LeadNoteWithAuthor>()

  const canAddNote = Boolean(
    user &&
      leadDetail &&
      (isAdmin || (leadDetail.corretor_id !== null && leadDetail.corretor_id === user.id))
  )
  const homePath = isAdmin ? "/" : "/kanban"
  const whatsappUrl = getWhatsAppUrl(leadDetail?.telefone_contato)
  const activityQuery = useQuery({
    queryKey: ["lead-activity", id],
    queryFn: () => fetchLeadActivities(id!),
    enabled: Boolean(id),
  })

  const notesQuery = useQuery({
    queryKey: ["lead-notes", id],
    queryFn: () => loadNotes(),
    enabled: Boolean(id),
  })

  const attachmentsQuery = useQuery({
    queryKey: [
      "lead-attachments",
      leadDetail?.id,
      leadDetail?.remotejid,
      leadDetail?.telefone_confirmado,
      leadDetail?.numero,
    ],
    queryFn: () => fetchLeadAttachments(leadDetail!),
    enabled: Boolean(leadDetail),
    retry: false,
  })

  const loadNotes = useCallback(async (): Promise<LeadNoteWithAuthor[]> => {
    if (!id) {
      return []
    }

    const { data: notesData, error: notesError } = await supabase
      .from(LEAD_NOTES_TABLE)
      .select("id,lead_id,author_id,content,created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })

    if (notesError) {
      throw notesError
    }

    const fetchedNotes = (notesData ?? []) as LeadNote[]
    const authorIds = [...new Set(fetchedNotes.map((note) => note.author_id))]

    if (authorIds.length === 0) {
      return fetchedNotes.map((note) => ({
        ...note,
        authorProfile: null,
      }))
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

    return fetchedNotes.map((note) => ({
      ...note,
      authorProfile: authorsById.get(note.author_id) ?? null,
    }))
  }, [id])

  const loadDetails = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!id) {
      setError("Lead não encontrado.")
      setLoading(false)
    }

    try {
      if (!silent) {
        setLoading(true)
      }

      const leadData = await fetchLeadById(id!)

      if (!leadData) {
        setError("Lead não encontrado.")
        setLeadDetail(null)
        setAssignedBroker(null)
        setMessages([])
        return
      }

      const detail = leadData as LeadDetail
      setLeadDetail(detail)

      const brokerPromise = detail.corretor_id
        ? supabase.from("profiles").select("id,nome,email").eq("id", detail.corretor_id).maybeSingle()
        : Promise.resolve({ data: null, error: null })

      const sessionId = getLeadSessionId(detail)
      const messagesPromise = fetchLeadMessagesByIdentifiers([
        sessionId,
        detail.remotejid,
        detail.numero,
        detail.telefone_confirmado,
        detail.telefone_contato,
      ])

      const [messagesResult, brokerResult] = await Promise.all([messagesPromise, brokerPromise])

      if (brokerResult.error) {
        throw brokerResult.error
      }

      setMessages(
        mapN8nMessages(
          (messagesResult ?? []) as Array<{
            id: number
            session_id: string
            message: unknown
            created_at: string | null
          }>,
          id!
        )
      )
      setAssignedBroker((brokerResult.data as Profile | null) ?? null)
      setError("")
    } catch (loadError) {
      console.error("Erro ao carregar detalhe do lead:", loadError)
      setError("Não conseguimos abrir esse lead agora.")
    } finally {
      setLoading(false)
    }
  }, [id])

  async function updateLead(
    values: Partial<Pick<LeadDetail, "ia_paused" | "arquivado" | "corretor_id" | "assumed_at" | "stage_id">>,
    action: "refresh" | "remove",
    options?: {
      previousSellerId?: string | null
      notifyReturnedToPool?: boolean
    }
  ) {
    if (!id) {
      return
    }

    try {
      setUpdating(true)

      await updateLeadState(id, {
        corretor_id:
          Object.prototype.hasOwnProperty.call(values, "corretor_id")
            ? (values.corretor_id ?? null)
            : (leadDetail?.corretor_id ?? null),
        assumed_at:
          Object.prototype.hasOwnProperty.call(values, "assumed_at")
            ? (values.assumed_at ?? null)
            : (leadDetail?.assumed_at ?? null),
        stage_id:
          Object.prototype.hasOwnProperty.call(values, "stage_id")
            ? (values.stage_id ?? null)
            : (leadDetail?.stage_id ?? null),
        arquivado:
          Object.prototype.hasOwnProperty.call(values, "arquivado")
            ? (values.arquivado ?? false)
            : (leadDetail?.arquivado ?? false),
        ia_paused:
          Object.prototype.hasOwnProperty.call(values, "ia_paused")
            ? (values.ia_paused ?? false)
            : (leadDetail?.ia_paused ?? false),
        first_response_at: leadDetail?.first_response_at ?? null,
      })

      const nextActivity =
        values.ia_paused === true
          ? { tipo: "ia" as const, descricao: "IA pausada" }
          : values.ia_paused === false
            ? { tipo: "ia" as const, descricao: "IA reativada" }
            : values.arquivado === true
              ? { tipo: "arquivamento" as const, descricao: "Lead arquivado" }
              : values.corretor_id === null
                ? { tipo: "pool" as const, descricao: "Lead devolvido ao pool" }
                : null

      if (nextActivity) {
        await safeLogLeadActivity({
          leadId: id,
          usuarioId: user?.id ?? null,
          tipo: nextActivity.tipo,
          descricao: nextActivity.descricao,
        }, { context: `lead-detail-${nextActivity.tipo}` })

        try {
          await logAuditEvent({
            actorUserId: user?.id ?? null,
            actorEmail: user?.email ?? null,
            entityType: "lead",
            entityId: id,
            action: nextActivity.tipo,
            description: nextActivity.descricao,
            beforeData: {
              corretor_id: leadDetail?.corretor_id ?? null,
              stage_id: leadDetail?.stage_id ?? null,
              arquivado: leadDetail?.arquivado ?? false,
              ia_paused: leadDetail?.ia_paused ?? false,
            },
            afterData: {
              corretor_id:
                Object.prototype.hasOwnProperty.call(values, "corretor_id")
                  ? (values.corretor_id ?? null)
                  : (leadDetail?.corretor_id ?? null),
              stage_id:
                Object.prototype.hasOwnProperty.call(values, "stage_id")
                  ? (values.stage_id ?? null)
                  : (leadDetail?.stage_id ?? null),
              arquivado:
                Object.prototype.hasOwnProperty.call(values, "arquivado")
                  ? (values.arquivado ?? false)
                  : (leadDetail?.arquivado ?? false),
              ia_paused:
                Object.prototype.hasOwnProperty.call(values, "ia_paused")
                  ? (values.ia_paused ?? false)
                  : (leadDetail?.ia_paused ?? false),
            },
          })
        } catch (auditError) {
          console.error("Erro ao registrar log de auditoria:", auditError)
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lead-activity", id] }),
        queryClient.invalidateQueries({ queryKey: ["archived-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["pool-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["kanban-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["team-data"] }),
      ])

      if (options?.notifyReturnedToPool && options.previousSellerId) {
        const notification = await notifyLeadAssignment(id, options.previousSellerId, "returned_to_pool")

        if (notification.status === "sent") {
          toast.success("Lead voltou para a fila e o vendedor foi avisado pelo WhatsApp.")
        } else if (notification.status === "failed" || notification.status === "error") {
          toast.error("Lead voltou para a fila, mas não foi possível avisar o vendedor pelo WhatsApp.")
        } else {
          toast.success("Lead voltou para a fila.")
        }
      } else if (values.corretor_id === null && values.assumed_at === null && values.stage_id === null) {
        toast.success("Lead voltou para a fila.")
      } else {
        toast.success("Lead atualizado com sucesso.")
      }

      if (action === "remove") {
        if (window.history.length > 1) {
          navigate(-1)
        } else {
          navigate(homePath, { replace: true })
        }
        return
      }

      await loadDetails({ silent: true })
    } catch (updateError) {
      console.error("Erro ao atualizar lead:", updateError)
      setError("Não foi possível atualizar esse lead agora.")
      toast.error("Não foi possível atualizar esse lead agora.")
    } finally {
      setUpdating(false)
      closeActionDialog()
    }
  }

  async function saveNote() {
    if (!id || !user || !canAddNote) {
      setError("Você não pode adicionar observações neste lead.")
      return
    }

    const content = newNote.trim()
    if (!content) {
      return
    }

    try {
      setSavingNote(true)

      const { error: insertError } = await supabase.from(LEAD_NOTES_TABLE).insert({
        lead_id: id,
        author_id: user.id,
        content,
      })

      if (insertError) {
        throw insertError
      }

      setNewNote("")
      await queryClient.invalidateQueries({ queryKey: ["lead-notes", id] })
      setError("")
      try {
        await logAuditEvent({
          actorUserId: user.id,
          actorEmail: user.email ?? null,
          entityType: "lead_note",
          entityId: id,
          action: "note_created",
          description: "Nota interna criada",
          afterData: {
            content,
          },
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }
      toast.success("Nota interna salva com sucesso.")
    } catch (saveError) {
      console.error("Erro ao salvar nota interna:", saveError)
      const message = getSupabaseErrorMessage(
        saveError,
        "Não foi possível salvar a observação."
      )
      setError(message)
      toast.error(message)
      return
      setError("Não foi possível salvar a observação.")
      toast.error("Não foi possível salvar a observação.")
    } finally {
      setSavingNote(false)
    }
  }

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const { error: updateError } = await supabase
        .from(LEAD_NOTES_TABLE)
        .update({ content })
        .eq("id", noteId)

      if (updateError) {
        throw updateError
      }
    },
    onSuccess: async () => {
      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "lead_note",
          entityId: editingNoteId ?? id ?? null,
          action: "note_updated",
          description: "Nota interna atualizada",
          afterData: {
            content: editingNoteContent.trim(),
          },
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }
      resetEditingNote()
      await queryClient.invalidateQueries({ queryKey: ["lead-notes", id] })
      toast.success("Nota atualizada com sucesso.")
    },
    onError: (updateError) => {
      const message = getSupabaseErrorMessage(updateError, "Não foi possível atualizar a observação.")
      setError(message)
      toast.error(message)
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error: deleteError } = await supabase.from(LEAD_NOTES_TABLE).delete().eq("id", noteId)

      if (deleteError) {
        throw deleteError
      }
    },
    onSuccess: async () => {
      try {
        await logAuditEvent({
          actorUserId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          entityType: "lead_note",
          entityId: pendingDeleteNote?.id ?? null,
          action: "note_deleted",
          description: "Nota interna excluída",
          beforeData: pendingDeleteNote
            ? {
                content: pendingDeleteNote.content,
                lead_id: pendingDeleteNote.lead_id,
              }
            : null,
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }
      closeNoteDeleteDialog()
      resetEditingNote()
      await queryClient.invalidateQueries({ queryKey: ["lead-notes", id] })
      toast.success("Nota excluída com sucesso.")
    },
    onError: (deleteError) => {
      const message = getSupabaseErrorMessage(deleteError, "Não foi possível excluir a observação.")
      setError(message)
      toast.error(message)
    },
  })

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDetails()
    }, 0)

    if (!id) {
      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    const channel = supabase
      .channel(`lead-detail-page-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LEAD_STATE_TABLE, filter: `lead_id=eq.${id}` },
        () => {
          void loadDetails({ silent: true })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LEAD_SOURCE_TABLE, filter: `id=eq.${id}` },
        () => {
          void loadDetails({ silent: true })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LEAD_MESSAGES_TABLE },
        () => {
          void loadDetails({ silent: true })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LEAD_NOTES_TABLE, filter: `lead_id=eq.${id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["lead-notes", id] })
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_attachments" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["lead-attachments"] })
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(timeoutId)
      void supabase.removeChannel(channel)
    }
  }, [id, loadDetails, queryClient])

  const pageTitle = leadDisplayName(leadDetail)
  const activities = activityQuery.data ?? []
  const notes = notesQuery.data ?? []
  const attachments = attachmentsQuery.data ?? []
  const hasEnergyAttachment = hasActiveEnergyAttachment(attachments)
  const attachmentsErrorMessage = attachmentsQuery.error
    ? getLeadAttachmentErrorMessage(
        attachmentsQuery.error,
        "Não foi possível carregar os anexos deste lead."
      )
    : null
  const selectedAttachmentTitle = selectedAttachment
    ? getLeadAttachmentFriendlyTitle(selectedAttachment)
    : "Conta de energia"
  const selectedAttachmentDateLabel = selectedAttachment
    ? `Enviada em ${formatDateTime(selectedAttachment.created_at)}`
    : null
  const selectedAttachmentIsPdf = selectedAttachment ? isLeadAttachmentPdf(selectedAttachment) : false
  const selectedAttachmentIsImage = selectedAttachment ? isLeadAttachmentImage(selectedAttachment) : false

  function canManageNote(note: LeadNoteWithAuthor) {
    return Boolean(user && (isAdmin || note.author_id === user.id))
  }

  async function downloadAttachment(attachment: LeadAttachment) {
    try {
      startAttachmentDownload(attachment.id)
      const signedUrl = await createLeadAttachmentSignedUrl(attachment, { download: true })
      window.open(signedUrl, "_blank", "noopener,noreferrer")
    } catch (attachmentError) {
      const message = getLeadAttachmentErrorMessage(
        attachmentError,
        "Não foi possível preparar o download do anexo."
      )
      toast.error(message)
    } finally {
      finishAttachmentDownload()
    }
  }

  async function uploadAttachmentForLead(file: File) {
    if (!leadDetail) {
      return
    }

    try {
      setUploadingAttachment(true)
      clearAttachmentUploadError()

      await uploadLeadAttachmentFromFile({
        file,
        lead: leadDetail,
        createdBy: user?.id ?? null,
      })

      await attachmentsQuery.refetch()
      toast.success("Conta de energia anexada com sucesso.")
    } catch (attachmentError) {
      const message = getLeadAttachmentErrorMessage(
        attachmentError,
        "Não foi possível anexar a conta. Tente novamente."
      )
      setAttachmentUploadError(message)
      toast.error(message)
    } finally {
      setUploadingAttachment(false)
    }
  }

  function handleUploadAttachmentClick() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/pdf,image/jpeg,image/png,image/webp"

    input.onchange = () => {
      const file = input.files?.[0] ?? null

      if (file) {
        void uploadAttachmentForLead(file)
      }
    }

    input.click()
  }

  async function openAttachmentInNewTab(attachment: LeadAttachment) {
    try {
      const signedUrl = await createLeadAttachmentSignedUrl(attachment)
      window.open(signedUrl, "_blank", "noopener,noreferrer")
    } catch (attachmentError) {
      const message = getLeadAttachmentErrorMessage(
        attachmentError,
        "Não foi possível abrir o anexo em nova aba."
      )
      toast.error(message)
    }
  }

  async function openAttachmentPreview(attachment: LeadAttachment) {
    openAttachmentPreviewUi(attachment)

    try {
      startAttachmentPreviewRequest(attachment.id)
      const signedUrl = await createLeadAttachmentSignedUrl(attachment)
      setAttachmentPreviewUrl(signedUrl)
    } catch (attachmentError) {
      const message = getLeadAttachmentErrorMessage(
        attachmentError,
        "Não foi possível carregar a visualização deste anexo."
      )
      setAttachmentPreviewError(message)
    } finally {
      finishAttachmentPreviewRequest()
    }
  }

  function closeAttachmentPreview() {
    closeAttachmentPreviewUi()
  }

  const statusBadges = useMemo(
    () => buildLeadStatusBadges({ lead: leadDetail, hasEnergyAttachment }),
    [hasEnergyAttachment, leadDetail]
  )

  const leadView = useMemo(
    () => buildLeadView({ lead: leadDetail, assignedBroker }),
    [assignedBroker, leadDetail]
  )

  const actionCopy = {
    "return-pool": {
      title: "Voltar para a fila",
      description: "Esse lead vai sair da carteira atual e ficar disponível para nova distribuição.",
      confirmLabel: "Devolver",
      run: () => {
        const previousSellerId = leadDetail?.corretor_id ?? null

        return updateLead(
          {
            corretor_id: null,
            assumed_at: null,
            stage_id: null,
          },
          "refresh",
          {
            previousSellerId,
            notifyReturnedToPool: Boolean(previousSellerId),
          }
        )
      },
    },
    archive: {
      title: "Arquivar lead",
      description: "O lead será retirado das listas ativas.",
      confirmLabel: "Arquivar",
      run: () => updateLead({ arquivado: true }, "remove"),
    },
  } as const

  return (
    <div className="space-y-5">
      <LeadDetailHeader
        loading={loading}
        pageTitle={pageTitle}
        createdAtLabel={`Lead criado ${formatRelativeTime(leadDetail?.created_at)}`}
        initials={getInitials(pageTitle)}
        statusBadges={statusBadges}
        onBack={() => {
          if (window.history.length > 1) {
            navigate(-1)
          } else {
            navigate(homePath, { replace: true })
          }
        }}
      />

      {error ? (
        <StatePanel tone="error" centered={false}>
          {error}
        </StatePanel>
      ) : null}

      {!loading && !leadDetail ? <StatePanel centered={false}>Lead não encontrado.</StatePanel> : null}

      <LeadDetailTabs activeTab={activeTab} onChange={setActiveTab}>
        <LeadDataTab
          loading={loading}
          hasLead={Boolean(leadDetail)}
          leadView={leadView}
          emptyValue={EMPTY_VALUE}
          whatsappUrl={whatsappUrl}
          attachments={attachments}
          attachmentsLoading={attachmentsQuery.isLoading}
          attachmentsErrorMessage={attachmentsErrorMessage}
          attachmentUploadError={attachmentUploadError}
          uploadingAttachment={uploadingAttachment}
          previewingAttachmentId={previewingAttachmentId}
          downloadingAttachmentId={downloadingAttachmentId}
          onOpenWhatsApp={() => {
            if (whatsappUrl) {
              window.open(whatsappUrl, "_blank", "noopener,noreferrer")
            }
          }}
          onUploadAttachment={handleUploadAttachmentClick}
          onViewAttachment={(attachment) => void openAttachmentPreview(attachment)}
          onDownloadAttachment={(attachment) => void downloadAttachment(attachment)}
          formatDateTime={formatDateTime}
          skeleton={<TabPanelSkeleton rows={6} />}
        />

        <LeadActionsTab
          loading={loading}
          hasLead={Boolean(leadDetail)}
          updating={updating}
          pendingAction={pendingAction}
          onSelectAction={openActionDialog}
          skeleton={<TabPanelSkeleton rows={3} />}
        />

        <LeadNotesTab
          loading={loading}
          notesLoading={notesQuery.isLoading}
          hasLead={Boolean(leadDetail)}
          notes={notes}
          canAddNote={canAddNote}
          canManageNote={canManageNote}
          editingNoteId={editingNoteId}
          editingNoteContent={editingNoteContent}
          newNote={newNote}
          savingNote={savingNote}
          updateNotePending={updateNoteMutation.isPending}
          deleteNotePending={deleteNoteMutation.isPending}
          setEditingNoteContent={setEditingNoteContent}
          setNewNote={setNewNote}
          startEditingNote={startEditingNote}
          cancelEditingNote={cancelEditingNote}
          requestDeleteNote={(note) => {
            if (note) {
              openNoteDeleteDialog(note)
            }
          }}
          saveEditedNote={(payload) => void updateNoteMutation.mutateAsync(payload)}
          saveNote={() => void saveNote()}
          formatDateTime={formatDateTime}
          skeleton={<TabPanelSkeleton rows={4} />}
        />

        <LeadConversationTab
          loading={loading}
          hasLead={Boolean(leadDetail)}
          activities={activities}
          activityLoading={activityQuery.isLoading}
          activityIcon={activityIcon}
          activityUserName={activityUserName}
          formatRelativeTime={formatRelativeTime}
          formatTimeOnly={formatTimeOnly}
          messages={messages}
          skeleton={<TabPanelSkeleton rows={4} />}
        />
      </LeadDetailTabs>

      <LeadAttachmentPreviewDialog
        selectedAttachment={selectedAttachment}
        selectedAttachmentTitle={selectedAttachmentTitle}
        selectedAttachmentDateLabel={selectedAttachmentDateLabel}
        attachmentPreviewLoading={attachmentPreviewLoading}
        attachmentPreviewError={attachmentPreviewError}
        attachmentPreviewUrl={attachmentPreviewUrl}
        selectedAttachmentIsImage={selectedAttachmentIsImage}
        selectedAttachmentIsPdf={selectedAttachmentIsPdf}
        downloadingAttachmentId={downloadingAttachmentId}
        onClose={closeAttachmentPreview}
        onOpenInNewTab={(attachment) => void openAttachmentInNewTab(attachment)}
        onDownload={(attachment) => void downloadAttachment(attachment)}
      />

      <LeadActionConfirmDialog
        pendingAction={Boolean(pendingAction)}
        title={pendingAction ? actionCopy[pendingAction].title : "Confirmar ação"}
        description={pendingAction ? actionCopy[pendingAction].description : "Confirme a ação neste lead."}
        confirmLabel={
          pendingAction
            ? actionCopy[pendingAction].confirmLabel
            : "Confirmar"
        }
        updating={updating}
        onCancel={closeActionDialog}
        onConfirm={() => {
          if (pendingAction) {
            void actionCopy[pendingAction].run()
          }
        }}
      />

      <LeadNoteDeleteDialog
        pendingDeleteNote={pendingDeleteNote}
        deleting={deleteNoteMutation.isPending}
        onCancel={closeNoteDeleteDialog}
        onConfirm={(noteId) => void deleteNoteMutation.mutateAsync(noteId)}
      />
    </div>
  )
}

