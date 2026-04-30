import { useCallback, useState } from "react"

export function useLeadAttachmentUiState<TAttachment>() {
  const [selectedAttachment, setSelectedAttachment] = useState<TAttachment | null>(null)
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<string | null>(null)
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null)
  const [attachmentPreviewLoading, setAttachmentPreviewLoading] = useState(false)
  const [attachmentPreviewError, setAttachmentPreviewError] = useState<string | null>(null)
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)

  const openAttachmentPreview = useCallback((attachment: TAttachment) => {
    setSelectedAttachment(attachment)
    setAttachmentPreviewUrl(null)
    setAttachmentPreviewError(null)
    setAttachmentPreviewLoading(true)
  }, [])

  const closeAttachmentPreview = useCallback(() => {
    setSelectedAttachment(null)
    setAttachmentPreviewUrl(null)
    setAttachmentPreviewError(null)
    setAttachmentPreviewLoading(false)
  }, [])

  const startAttachmentPreviewRequest = useCallback((attachmentId: string) => {
    setPreviewingAttachmentId(attachmentId)
  }, [])

  const finishAttachmentPreviewRequest = useCallback(() => {
    setPreviewingAttachmentId(null)
    setAttachmentPreviewLoading(false)
  }, [])

  const startAttachmentDownload = useCallback((attachmentId: string) => {
    setDownloadingAttachmentId(attachmentId)
  }, [])

  const finishAttachmentDownload = useCallback(() => {
    setDownloadingAttachmentId(null)
  }, [])

  const clearAttachmentUploadError = useCallback(() => {
    setAttachmentUploadError(null)
  }, [])

  return {
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
    openAttachmentPreview,
    closeAttachmentPreview,
    startAttachmentPreviewRequest,
    finishAttachmentPreviewRequest,
    startAttachmentDownload,
    finishAttachmentDownload,
    clearAttachmentUploadError,
  }
}
