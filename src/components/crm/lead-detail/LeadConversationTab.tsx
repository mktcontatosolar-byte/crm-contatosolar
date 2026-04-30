import { TabsContent } from "@/components/ui/tabs"
import { RefreshCw } from "lucide-react"
import type { ReactNode } from "react"
import { LeadConversationPanel } from "@/components/crm/lead-detail/LeadDetailSections"
import type { LeadActivity } from "@/types"

type ActivityIconFn = (activity: LeadActivity) => typeof RefreshCw

export function LeadConversationTab({
  loading,
  hasLead,
  activities,
  activityLoading,
  activityIcon,
  activityUserName,
  formatRelativeTime,
  formatTimeOnly,
  messages,
  skeleton,
}: {
  loading: boolean
  hasLead: boolean
  activities: LeadActivity[]
  activityLoading: boolean
  activityIcon: ActivityIconFn
  activityUserName: (activity: LeadActivity) => string
  formatRelativeTime: (value: string | null | undefined) => string
  formatTimeOnly: (value: string | null | undefined) => string
  messages: Array<{
    id: string
    lead_id: string
    role: "user" | "bot"
    content: string
    created_at: string
  }>
  skeleton: ReactNode
}) {
  return (
    <TabsContent value="historico">
      {loading ? (
        skeleton
      ) : hasLead ? (
        <LeadConversationPanel
          activities={activities}
          activityLoading={activityLoading}
          activityIcon={activityIcon}
          activityUserName={activityUserName}
          formatRelativeTime={formatRelativeTime}
          formatTimeOnly={formatTimeOnly}
          messages={messages}
        />
      ) : null}
    </TabsContent>
  )
}
