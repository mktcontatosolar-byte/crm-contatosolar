import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import StatePanel from "@/components/crm/StatePanel"
import type { LeadAttachment } from "@/types/leadAttachments"

export function LeadAttachmentPreviewDialog({
  selectedAttachment,
  selectedAttachmentTitle,
  selectedAttachmentDateLabel,
  attachmentPreviewLoading,
  attachmentPreviewError,
  attachmentPreviewUrl,
  selectedAttachmentIsImage,
  selectedAttachmentIsPdf,
  downloadingAttachmentId,
  onClose,
  onOpenInNewTab,
  onDownload,
}: {
  selectedAttachment: LeadAttachment | null
  selectedAttachmentTitle: string
  selectedAttachmentDateLabel: string | null
  attachmentPreviewLoading: boolean
  attachmentPreviewError: string | null
  attachmentPreviewUrl: string | null
  selectedAttachmentIsImage: boolean
  selectedAttachmentIsPdf: boolean
  downloadingAttachmentId: string | null
  onClose: () => void
  onOpenInNewTab: (attachment: LeadAttachment) => void
  onDownload: (attachment: LeadAttachment) => void
}) {
  return (
    <Dialog open={Boolean(selectedAttachment)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton
        className="max-h-[calc(100vh-2rem)] overflow-hidden rounded-[2rem] p-0 sm:max-w-5xl"
      >
        <div className="flex max-h-[calc(100vh-2rem)] flex-col">
          <DialogHeader className="gap-2 border-b border-border/60 px-6 py-5">
            <DialogTitle>{selectedAttachmentTitle}</DialogTitle>
            <DialogDescription>{selectedAttachmentDateLabel}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {attachmentPreviewLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-48 rounded-full" />
                <Skeleton className="h-[60vh] w-full rounded-3xl" />
              </div>
            ) : attachmentPreviewError ? (
              <StatePanel tone="warning" centered={false}>
                {attachmentPreviewError}
              </StatePanel>
            ) : attachmentPreviewUrl && selectedAttachment ? (
              selectedAttachmentIsImage ? (
                <div className="overflow-auto rounded-3xl border border-border/60 bg-background/70 p-3">
                  <img
                    src={attachmentPreviewUrl}
                    alt={selectedAttachmentTitle}
                    className="mx-auto h-auto max-w-full rounded-2xl"
                  />
                </div>
              ) : selectedAttachmentIsPdf ? (
                <div className="overflow-hidden rounded-3xl border border-border/60 bg-background/70">
                  <iframe
                    src={attachmentPreviewUrl}
                    title={selectedAttachmentTitle}
                    className="h-[70vh] w-full"
                  />
                </div>
              ) : (
                <StatePanel centered={false}>
                  A pré-visualização deste arquivo não está disponível no CRM.
                </StatePanel>
              )
            ) : (
              <StatePanel centered={false}>
                Não foi possível preparar a visualização deste arquivo.
              </StatePanel>
            )}
          </div>

          <DialogFooter className="border-t border-border/60 px-6 py-5 sm:justify-between">
            {selectedAttachment && selectedAttachmentIsPdf ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full"
                onClick={() => onOpenInNewTab(selectedAttachment)}
              >
                Abrir em nova aba
              </Button>
            ) : (
              <div />
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full"
                onClick={onClose}
              >
                Fechar
              </Button>
              <Button
                type="button"
                className="h-11 rounded-full"
                disabled={!selectedAttachment || downloadingAttachmentId === selectedAttachment.id}
                onClick={() => (selectedAttachment ? onDownload(selectedAttachment) : undefined)}
              >
                {selectedAttachment && downloadingAttachmentId === selectedAttachment.id
                  ? "Preparando..."
                  : "Baixar"}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function LeadActionConfirmDialog({
  pendingAction,
  title,
  description,
  confirmLabel,
  updating,
  onCancel,
  onConfirm,
}: {
  pendingAction: boolean
  title: string
  description: string
  confirmLabel: string
  updating: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={pendingAction} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-full"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-12 rounded-full"
            disabled={!pendingAction || updating}
            onClick={onConfirm}
          >
            {updating && pendingAction ? "Processando..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function LeadNoteDeleteDialog({
  pendingDeleteNote,
  deleting,
  onCancel,
  onConfirm,
}: {
  pendingDeleteNote: {
    id: string
    authorProfile: {
      nome: string | null
      email: string | null
    } | null
  } | null
  deleting: boolean
  onCancel: () => void
  onConfirm: (noteId: string) => void
}) {
  return (
    <Dialog open={Boolean(pendingDeleteNote)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Excluir nota?</DialogTitle>
          <DialogDescription>
            {pendingDeleteNote
              ? `A nota de ${pendingDeleteNote.authorProfile?.nome || pendingDeleteNote.authorProfile?.email || "autor desconhecido"} será removida permanentemente.`
              : "Confirme a exclusão desta nota interna."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-full"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-12 rounded-full"
            disabled={!pendingDeleteNote || deleting}
            onClick={() => (pendingDeleteNote ? onConfirm(pendingDeleteNote.id) : undefined)}
          >
            {deleting ? "Excluindo..." : "Confirmar exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
