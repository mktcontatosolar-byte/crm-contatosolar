import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, FilePlus2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import ManualLeadForm from "@/components/ManualLeadForm"
import PageIntro from "@/components/crm/PageIntro"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/contexts/useAuth"
import { logAuditEvent } from "@/lib/auditLogs"
import { createManualLead } from "@/lib/crmLeads"
import { safeLogLeadActivity } from "@/lib/leadActivity"
import { getLeadAttachmentErrorMessage, uploadLeadAttachmentFromFile } from "@/lib/leadAttachments"

export default function ManualLeadPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const createManualLeadMutation = useMutation({
    mutationFn: async ({
      lead: values,
      attachmentFile,
    }: {
      lead: Parameters<typeof createManualLead>[0]
      attachmentFile: File | null
    }) => {
      if (!user) {
        throw new Error("Sessão inválida para criar o lead manual.")
      }

      const lead = await createManualLead(values, user.id)
      let attachmentUploadFailed = false

      await safeLogLeadActivity({
        leadId: lead.id,
        usuarioId: user.id,
        tipo: "atribuicao",
        descricao: "Lead manual criado e atribuído ao vendedor",
        metadata: {
          lead_entry_type: "manual",
        },
      }, { context: "manual-lead-created" })

      try {
        await logAuditEvent({
          actorUserId: user.id,
          actorEmail: user.email ?? null,
          entityType: "lead",
          entityId: lead.id,
          action: "manual_created",
          description: "Lead manual criado no CRM",
          afterData: {
            nome: lead.nome_completo,
            telefone_contato: lead.telefone_contato,
            email: lead.email,
            origem: lead.origem,
            campanha: lead.campanha,
            lead_entry_type: lead.lead_entry_type,
            corretor_id: lead.corretor_id,
          },
        })
      } catch (auditError) {
        console.error("Erro ao registrar log de auditoria:", auditError)
      }

      if (attachmentFile) {
        try {
          await uploadLeadAttachmentFromFile({
            file: attachmentFile,
            lead,
            createdBy: user.id,
          })
        } catch (attachmentError) {
          attachmentUploadFailed = true
          console.error("Erro ao anexar conta de energia no lead manual:", attachmentError)
        }
      }

      return {
        lead,
        attachmentUploadFailed,
        hadAttachment: Boolean(attachmentFile),
      }
    },
    onSuccess: async ({ lead, attachmentUploadFailed, hadAttachment }) => {
      if (hadAttachment && !attachmentUploadFailed) {
        toast.success("Lead criado com conta de energia anexada.")
      } else if (hadAttachment && attachmentUploadFailed) {
        toast.warning("Lead criado, mas não foi possível anexar a conta de energia. Você pode tentar novamente depois.")
      } else {
        toast.success("Lead criado com sucesso.")
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kanban-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["pool-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["team-data"] }),
        queryClient.invalidateQueries({ queryKey: ["lead-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["lead-attachments"] }),
      ])
      navigate(`/leads/${lead.id}`)
    },
    onError: (createError) => {
      console.error("Erro ao criar lead manual:", createError)
      toast.error(
        createError instanceof Error
          ? getLeadAttachmentErrorMessage(createError, "Não foi possível salvar esse lead manual agora.")
          : "Não foi possível salvar esse lead manual agora."
      )
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => navigate("/kanban")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para o Kanban
        </Button>
      </div>

      <PageIntro
        badge="Cadastro interno"
        badgeTone="sky"
        title="Novo lead manual"
        description="Cadastre um lead fora das campanhas e inclua todas as informações que fizerem sentido, sem precisar preencher o resto."
        aside={
          <div className="rounded-3xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
            <p className="text-xs uppercase tracking-[0.18em]">Fluxo</p>
            <p className="mt-2 text-foreground">
              O lead será criado já atribuído a você e marcado como manual no CRM.
            </p>
          </div>
        }
      />

      <Card className="rounded-3xl border border-border/60 bg-card/92 shadow-sm">
        <CardContent className="space-y-6 p-5 sm:p-6 lg:p-8">
          <div className="flex items-center gap-3 rounded-3xl border border-border/60 bg-background/60 p-4">
            <div className="rounded-2xl border border-border/60 bg-card/90 p-3">
              <FilePlus2 className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Formulário completo</p>
              <p className="text-sm text-muted-foreground">
                Preencha só o que você tiver agora. O restante pode ficar vazio sem quebrar o processo.
              </p>
            </div>
          </div>

          <ManualLeadForm
            onSubmit={async (values) => {
              await createManualLeadMutation.mutateAsync(values)
            }}
            isSubmitting={createManualLeadMutation.isPending}
            onCancel={() => navigate("/kanban")}
            submitLabel="Criar lead manual"
          />
        </CardContent>
      </Card>
    </div>
  )
}


