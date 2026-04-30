import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function LeadDetailTabs({
  activeTab,
  onChange,
  children,
}: {
  activeTab: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <Tabs value={activeTab} onValueChange={onChange}>
      <TabsList className="no-scrollbar">
        <TabsTrigger value="dados">Dados</TabsTrigger>
        <TabsTrigger value="acoes">Ações</TabsTrigger>
        <TabsTrigger value="notas">Notas</TabsTrigger>
        <TabsTrigger value="historico">Conversa</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  )
}
