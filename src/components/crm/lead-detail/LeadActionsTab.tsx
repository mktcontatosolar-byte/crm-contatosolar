import { TabsContent } from "@/components/ui/tabs"
import type { ReactNode } from "react"
import { LeadActionsPanel } from "@/components/crm/lead-detail/LeadDetailSections"

export function LeadActionsTab({
  loading,
  hasLead,
  updating,
  pendingAction,
  onSelectAction,
  skeleton,
}: {
  loading: boolean
  hasLead: boolean
  updating: boolean
  pendingAction: "return-pool" | "archive" | null
  onSelectAction: (action: "return-pool" | "archive") => void
  skeleton: ReactNode
}) {
  return (
    <TabsContent value="acoes">
      {loading ? (
        skeleton
      ) : hasLead ? (
        <LeadActionsPanel
          updating={updating}
          pendingAction={pendingAction}
          onSelectAction={onSelectAction}
        />
      ) : null}
    </TabsContent>
  )
}
