import { useCallback, useState } from "react"

type EditableLeadNote = {
  id: string
  content: string
}

export function useLeadNoteEditing<TNote extends EditableLeadNote>() {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState("")

  const startEditingNote = useCallback((note: TNote) => {
    setEditingNoteId(note.id)
    setEditingNoteContent(note.content)
  }, [])

  const cancelEditingNote = useCallback(() => {
    setEditingNoteId(null)
    setEditingNoteContent("")
  }, [])

  const resetEditingNote = useCallback(() => {
    setEditingNoteId(null)
    setEditingNoteContent("")
  }, [])

  return {
    editingNoteId,
    editingNoteContent,
    setEditingNoteContent,
    startEditingNote,
    cancelEditingNote,
    resetEditingNote,
  }
}
