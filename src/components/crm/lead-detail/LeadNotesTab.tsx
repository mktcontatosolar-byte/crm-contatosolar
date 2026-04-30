import { TabsContent } from "@/components/ui/tabs"
import type { ReactNode } from "react"
import { LeadNotesPanel } from "@/components/crm/lead-detail/LeadDetailSections"
import type { LeadNote, Profile } from "@/types"

type LeadNoteWithAuthor = LeadNote & { authorProfile: Profile | null }

export function LeadNotesTab({
  loading,
  notesLoading,
  hasLead,
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
  skeleton,
}: {
  loading: boolean
  notesLoading: boolean
  hasLead: boolean
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
  requestDeleteNote: (note: LeadNoteWithAuthor | null) => void
  saveEditedNote: (payload: { noteId: string; content: string }) => void
  saveNote: () => void
  formatDateTime: (value: string | null | undefined) => string
  skeleton: ReactNode
}) {
  return (
    <TabsContent value="notas">
      {loading || notesLoading ? (
        skeleton
      ) : hasLead ? (
        <LeadNotesPanel
          notes={notes}
          canAddNote={canAddNote}
          canManageNote={canManageNote}
          editingNoteId={editingNoteId}
          editingNoteContent={editingNoteContent}
          newNote={newNote}
          savingNote={savingNote}
          updateNotePending={updateNotePending}
          deleteNotePending={deleteNotePending}
          setEditingNoteContent={setEditingNoteContent}
          setNewNote={setNewNote}
          startEditingNote={startEditingNote}
          cancelEditingNote={cancelEditingNote}
          requestDeleteNote={requestDeleteNote}
          saveEditedNote={saveEditedNote}
          saveNote={saveNote}
          formatDateTime={formatDateTime}
        />
      ) : null}
    </TabsContent>
  )
}
