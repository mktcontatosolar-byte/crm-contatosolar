import { TabsContent } from "@/components/ui/tabs"
import type { ReactNode } from "react"
import {
  LeadAttachmentsCard,
  LeadCommercialInfoCard,
  LeadContactInfoCard,
  LeadDatesCard,
  type LeadViewModel,
} from "@/components/crm/lead-detail/LeadDetailSections"
import type { LeadAttachment } from "@/types/leadAttachments"

export function LeadDataTab({
  loading,
  hasLead,
  leadView,
  emptyValue,
  whatsappUrl,
  attachments,
  attachmentsLoading,
  attachmentsErrorMessage,
  attachmentUploadError,
  uploadingAttachment,
  previewingAttachmentId,
  downloadingAttachmentId,
  onOpenWhatsApp,
  onUploadAttachment,
  onViewAttachment,
  onDownloadAttachment,
  formatDateTime,
  skeleton,
}: {
  loading: boolean
  hasLead: boolean
  leadView: LeadViewModel | null
  emptyValue: string
  whatsappUrl: string | null
  attachments: LeadAttachment[]
  attachmentsLoading: boolean
  attachmentsErrorMessage: string | null
  attachmentUploadError: string | null
  uploadingAttachment: boolean
  previewingAttachmentId: string | null
  downloadingAttachmentId: string | null
  onOpenWhatsApp: () => void
  onUploadAttachment: () => void
  onViewAttachment: (attachment: LeadAttachment) => void
  onDownloadAttachment: (attachment: LeadAttachment) => void
  formatDateTime: (value: string | null | undefined) => string
  skeleton: ReactNode
}) {
  return (
    <TabsContent value="dados">
      {loading ? (
        skeleton
      ) : hasLead && leadView ? (
        <div className="space-y-4">
          <LeadCommercialInfoCard
            leadView={leadView}
            emptyValue={emptyValue}
            whatsappUrl={whatsappUrl}
            onOpenWhatsApp={onOpenWhatsApp}
          />
          <LeadContactInfoCard leadView={leadView} emptyValue={emptyValue} />
          <LeadDatesCard leadView={leadView} emptyValue={emptyValue} />
          <LeadAttachmentsCard
            attachments={attachments}
            loading={attachmentsLoading}
            errorMessage={attachmentsErrorMessage}
            uploadErrorMessage={attachmentUploadError}
            uploading={uploadingAttachment}
            previewingAttachmentId={previewingAttachmentId}
            downloadingAttachmentId={downloadingAttachmentId}
            onUploadAttachment={onUploadAttachment}
            onViewAttachment={onViewAttachment}
            onDownloadAttachment={onDownloadAttachment}
            formatDateTime={formatDateTime}
          />
        </div>
      ) : null}
    </TabsContent>
  )
}
