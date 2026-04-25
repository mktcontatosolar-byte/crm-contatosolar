import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, SearchX } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchLeadBrokerMap, searchCrmLeads } from "@/lib/crmLeads"
import { cn, formatSupabaseValue } from "@/lib/utils"
import type { Lead } from "@/types"

type SearchLead = Pick<
  Lead,
  "id" | "nome_completo" | "email" | "telefone_contato" | "status_conversa" | "corretor_id"
> & {
  brokerName: string | null
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function leadDisplayName(lead: SearchLead) {
  return lead.nome_completo || lead.email || lead.telefone_contato || "Lead sem identificação"
}

function getStatusBadge(status: string | null) {
  const normalized = (status ?? "").toLowerCase()

  if (normalized === "qualificado") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  }

  if (normalized.includes("pendente")) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300"
  }

  if (normalized.includes("perd")) {
    return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
  }

  if (normalized.includes("fech")) {
    return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300"
  }

  return "border-border/60 bg-muted/60 text-foreground"
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeoutId)
  }, [delay, value])

  return debouncedValue
}

async function searchLeads(query: string): Promise<SearchLead[]> {
  const leads = (await searchCrmLeads(query)) as Array<
    Pick<Lead, "id" | "nome_completo" | "email" | "telefone_contato" | "status_conversa" | "corretor_id">
  >
  const brokersById = await fetchLeadBrokerMap(leads)

  return leads.map((lead) => ({
    ...lead,
    brokerName: lead.corretor_id ? (brokersById.get(lead.corretor_id) ?? null) : null,
  }))
}

function SearchResultSkeleton() {
  return (
    <div className="flex min-h-[76px] items-center gap-4 rounded-[1.25rem] px-4 py-4">
      <Skeleton className="h-11 w-11 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-44 rounded-2xl" />
        <Skeleton className="h-4 w-64 rounded-2xl" />
      </div>
    </div>
  )
}

export default function GlobalLeadSearch({
  variant = "default",
}: {
  variant?: "default" | "sidebar"
}) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedTerm = useDebouncedValue(searchTerm, 300)

  const searchQuery = useQuery({
    queryKey: ["global-lead-search", debouncedTerm],
    queryFn: () => searchLeads(debouncedTerm),
    enabled: open && debouncedTerm.trim().length >= 2,
  })

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [open])

  const results = useMemo(() => searchQuery.data ?? [], [searchQuery.data])

  return (
    <>
      {variant === "sidebar" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-11 w-11 rounded-full"
          onClick={() => setOpen(true)}
          aria-label="Buscar lead"
        >
          <Search className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="min-h-12 rounded-3xl px-4"
          onClick={() => setOpen(true)}
        >
          <Search className="mr-2 h-4 w-4" />
          Buscar lead
          <span className="ml-3 hidden rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:inline-flex">
            Ctrl+K
          </span>
        </Button>
      )}

      <CommandDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            setSearchTerm("")
          }
        }}
      >
        <Command shouldFilter={false} className="bg-card/95">
          <CommandInput
            ref={inputRef}
            value={searchTerm}
            onValueChange={setSearchTerm}
            placeholder="Busque por nome, e-mail ou telefone"
            className="text-base sm:text-lg"
          />
          <CommandSeparator />

          <CommandList className="min-h-[320px]">
            {searchTerm.trim().length < 2 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="rounded-full border border-border/60 bg-background/80 p-3">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Busque qualquer lead do CRM</p>
                  <p className="text-sm text-muted-foreground">Digite pelo menos 2 caracteres para começar.</p>
                </div>
              </div>
            ) : null}

            {searchTerm.trim().length >= 2 && searchQuery.isLoading ? (
              <CommandGroup heading="Buscando">
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <SearchResultSkeleton key={index} />
                  ))}
                </div>
              </CommandGroup>
            ) : null}

            {searchTerm.trim().length >= 2 && !searchQuery.isLoading ? (
              <>
                <CommandEmpty>
                  <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
                    <div className="rounded-full border border-border/60 bg-background/80 p-3">
                      <SearchX className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Nenhum lead encontrado</p>
                      <p className="text-sm text-muted-foreground">Tente outro nome, e-mail ou telefone.</p>
                    </div>
                  </div>
                </CommandEmpty>

                <CommandGroup heading="Resultados">
                  {results.map((lead) => (
                    <CommandItem
                      key={lead.id}
                      value={`${lead.id}-${leadDisplayName(lead)}`}
                      className="min-h-[76px] items-center gap-4 rounded-[1.25rem] px-4 py-4"
                      onSelect={() => {
                        setOpen(false)
                        navigate(`/leads/${lead.id}`)
                      }}
                    >
                      <Avatar className="h-11 w-11" size="lg">
                        <AvatarFallback>{getInitials(leadDisplayName(lead))}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{leadDisplayName(lead)}</p>
                          <Badge
                            className={cn(
                              "min-h-6 rounded-full px-2.5 text-[11px] font-medium",
                              getStatusBadge(lead.status_conversa)
                            )}
                          >
                            {formatSupabaseValue(lead.status_conversa)}
                          </Badge>
                        </div>

                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          <span className="truncate">{formatSupabaseValue(lead.email || lead.telefone_contato)}</span>
                          <span>{formatSupabaseValue(lead.brokerName)}</span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
