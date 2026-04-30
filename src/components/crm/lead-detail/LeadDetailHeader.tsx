import { LeadHeaderCard } from "@/components/crm/lead-detail/LeadDetailSections"

type HeaderBadge = {
  label: string
  tone?: "primary" | "accent" | "muted" | "outline"
  className: string
}

export function LeadDetailHeader({
  loading,
  pageTitle,
  createdAtLabel,
  initials,
  statusBadges,
  onBack,
}: {
  loading: boolean
  pageTitle: string
  createdAtLabel: string
  initials: string
  statusBadges: HeaderBadge[]
  onBack: () => void
}) {
  return (
    <LeadHeaderCard
      loading={loading}
      pageTitle={pageTitle}
      createdAtLabel={createdAtLabel}
      initials={initials}
      statusBadges={statusBadges}
      onBack={onBack}
    />
  )
}
