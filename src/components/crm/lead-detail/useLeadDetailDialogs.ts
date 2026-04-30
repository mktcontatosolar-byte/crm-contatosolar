import { useCallback, useState } from "react"

export function useLeadDetailDialogs<TAction extends string, TNote>() {
  const [pendingAction, setPendingAction] = useState<TAction | null>(null)
  const [pendingDeleteNote, setPendingDeleteNote] = useState<TNote | null>(null)

  const openActionDialog = useCallback((action: TAction) => {
    setPendingAction(action)
  }, [])

  const closeActionDialog = useCallback(() => {
    setPendingAction(null)
  }, [])

  const openNoteDeleteDialog = useCallback((note: TNote) => {
    setPendingDeleteNote(note)
  }, [])

  const closeNoteDeleteDialog = useCallback(() => {
    setPendingDeleteNote(null)
  }, [])

  return {
    pendingAction,
    pendingDeleteNote,
    openActionDialog,
    closeActionDialog,
    openNoteDeleteDialog,
    closeNoteDeleteDialog,
  }
}
