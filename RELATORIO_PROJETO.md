# Relatorio Completo do Projeto -- Contato Solar CRM

**Data:** 07 de maio de 2026
**Tipo:** Documentacao tecnica e funcional completa
**Aplicacao:** CRM para gestao de leads de energia solar

---

## 1. Visao Geral

O **Contato Solar CRM** e uma aplicacao web completa para gestao de leads comerciais no setor de energia solar fotovoltaica. O sistema cobre todo o ciclo de vida de um lead: desde a captacao automatica via WhatsApp/Meta Ads ate o fechamento do projeto e acompanhamento de pagamento.

O CRM atende tres perfis de usuario com permissoes hierarquicas:
- **Dono** (owner) -- acesso total, gestao de projetos e dados financeiros sensiveis
- **Admin** -- gestao de equipe, leads e metricas operacionais
- **Corretor** (broker) -- atendimento de leads atribuidos, movimentacao no Kanban

---

## 2. Stack Tecnologica

### Frontend

| Tecnologia | Versao | Funcao |
|---|---|---|
| **React** | 19.2.5 | Framework de UI |
| **TypeScript** | 6.0.2 | Tipagem estatica |
| **Vite** | 8.0.10 | Build tool e dev server |
| **Tailwind CSS** | 4.2.4 | Framework de estilos utility-first |
| **React Router DOM** | 7.14.2 | Roteamento SPA |
| **TanStack React Query** | 5.100.1 | Gerenciamento de estado do servidor (cache, fetching, mutations) |
| **React Hook Form** | 7.73.1 | Formularios com validacao |
| **Zod** | 4.3.6 | Validacao de schemas |
| **Radix UI** | 1.4.3 | Componentes primitivos acessiveis (via shadcn/ui) |
| **shadcn/ui** | 4.4.0 | Biblioteca de componentes estilizados |
| **@dnd-kit** | core 6.3, sortable 10.0 | Drag-and-drop para Kanban |
| **date-fns** | 4.1.0 | Manipulacao de datas (locale pt-BR) |
| **ExcelJS** | 4.4.0 | Geracao de planilhas Excel (import dinamico) |
| **Lucide React** | 1.9.0 | Biblioteca de icones |
| **Sonner** | 2.0.7 | Notificacoes toast |
| **next-themes** | 0.4.6 | Dark mode / light mode |
| **cmdk** | 1.1.1 | Busca global estilo Cmd+K |
| **class-variance-authority** | 0.7.1 | Variantes de componentes CSS |

### Backend (Supabase)

| Tecnologia | Funcao |
|---|---|
| **Supabase Auth** | Autenticacao (email + senha) com JWT |
| **Supabase Database (PostgreSQL)** | Banco relacional com RLS (Row Level Security) |
| **Supabase Storage** | Armazenamento de arquivos (contas de energia, anexos) |
| **Supabase Edge Functions (Deno)** | Logica serverless (criacao de usuarios, notificacoes WhatsApp, upload de anexos) |
| **Supabase Realtime** | Subscricoes em tempo real (nao utilizado extensivamente no momento) |

### Integracoes Externas

| Servico | Funcao |
|---|---|
| **N8N** | Automacao de fluxo -- captura de leads via WhatsApp, chatbot IA, armazenamento de historico de conversa |
| **UAZAPI** | Provedor de envio de mensagens WhatsApp para notificacoes de atribuicao de leads |
| **Meta Ads** | Origem dos leads via campanhas de anuncios (integrado via N8N) |

### DevDependencies e Tooling

| Tecnologia | Funcao |
|---|---|
| **Vitest** | Framework de testes unitarios |
| **jsdom** | Ambiente DOM para testes |
| **ESLint** | Linting de codigo |
| **PostCSS + Autoprefixer** | Processamento CSS |

---

## 3. Arquitetura do Projeto

```
E:\crm-contatosolar/
|
├── src/
│   ├── main.tsx                    # Entry point: React root + providers
│   ├── App.tsx                     # Roteamento com React Router
│   ├── index.css                   # Estilos globais + design tokens OKLch
│   │
│   ├── pages/                      # 12 paginas/rotas
│   │   ├── Login.tsx
│   │   ├── KanbanPage.tsx          # Board de leads do corretor
│   │   ├── PoolLeadsPage.tsx       # Pool de leads sem dono (admin)
│   │   ├── LeadDetailPage.tsx      # Detalhe completo do lead
│   │   ├── ManualLeadPage.tsx      # Criacao manual de lead
│   │   ├── ProjectsPage.tsx        # Gestao de projetos (dono)
│   │   ├── CompetitionPage.tsx     # Competicao de vendas
│   │   ├── DashboardGeneralPage.tsx # Dashboard gerencial
│   │   ├── MetricsPage.tsx         # Metricas de performance
│   │   ├── TeamPage.tsx            # Gestao de equipe
│   │   ├── ArchivedLeadsPage.tsx   # Leads arquivados
│   │   └── LogsPage.tsx            # Logs de auditoria
│   │
│   ├── components/
│   │   ├── Layout.tsx              # Layout master com sidebar
│   │   ├── Sidebar.tsx             # Navegacao lateral com menu por role
│   │   ├── GlobalLeadSearch.tsx    # Busca global Cmd+K
│   │   ├── LeadDetailModal.tsx     # Modal de resumo do lead
│   │   ├── ManualLeadForm.tsx      # Formulario de criacao de lead
│   │   ├── ThemeProvider.tsx       # Provider de dark/light mode
│   │   ├── ThemeToggle.tsx         # Toggle de tema
│   │   │
│   │   ├── ui/                     # 16 primitivos shadcn/Radix UI
│   │   │   ├── button.tsx, card.tsx, dialog.tsx, input.tsx
│   │   │   ├── label.tsx, select.tsx, sheet.tsx, tabs.tsx
│   │   │   ├── textarea.tsx, badge.tsx, avatar.tsx
│   │   │   ├── dropdown-menu.tsx, command.tsx, tooltip.tsx
│   │   │   ├── skeleton.tsx, sonner.tsx
│   │   │
│   │   ├── crm/                    # 9 componentes de dominio CRM
│   │   │   ├── FilterBar.tsx       # Barra de filtros
│   │   │   ├── PageIntro.tsx       # Header de pagina
│   │   │   ├── ResponsiveTable.tsx # Tabela responsiva
│   │   │   ├── SectionCard.tsx     # Card de secao
│   │   │   ├── StatCard.tsx        # Card de metrica
│   │   │   ├── StatePanel.tsx      # Painel de estado/alerta
│   │   │   ├── StatusBadge.tsx     # Badge de status
│   │   │   ├── InfoField.tsx       # Campo de informacao
│   │   │   └── MetricGrid.tsx      # Grid de metricas
│   │   │
│   │   ├── crm/lead-detail/       # 12 arquivos do detalhe do lead
│   │   │   ├── LeadDetailHeader.tsx
│   │   │   ├── LeadDetailTabs.tsx
│   │   │   ├── LeadDataTab.tsx
│   │   │   ├── LeadActionsTab.tsx
│   │   │   ├── LeadNotesTab.tsx
│   │   │   ├── LeadConversationTab.tsx
│   │   │   ├── LeadDetailDialogs.tsx
│   │   │   ├── LeadDetailSections.tsx
│   │   │   ├── leadDetailViewModel.ts
│   │   │   ├── useLeadDetailDialogs.ts
│   │   │   ├── useLeadAttachmentUiState.ts
│   │   │   └── useLeadNoteEditing.ts
│   │   │
│   │   └── projects/              # 2 componentes de projetos
│   │       ├── BarList.tsx         # Barra horizontal de ranking
│   │       └── MaskedValue.tsx     # Mascaramento de valores sensiveis
│   │
│   ├── lib/                        # 15 modulos de logica de negocio
│   │   ├── supabase.ts            # Cliente Supabase
│   │   ├── crmLeads.ts            # CRUD de leads + queries
│   │   ├── permissions.ts         # Controle de acesso por role
│   │   ├── auditLogs.ts           # Logs de auditoria
│   │   ├── leadActivity.ts        # Rastreamento de atividades
│   │   ├── leadAttachments.ts     # Upload e gestao de anexos
│   │   ├── leadMessages.ts        # Historico de conversa
│   │   ├── leadAssignmentNotifications.ts # Notificacoes WhatsApp
│   │   ├── manageUser.ts          # Criacao/exclusao de usuarios
│   │   ├── projects.ts            # CRUD de projetos
│   │   ├── projectExport.ts       # Exportacao de projetos
│   │   ├── exportLeadsData.ts     # Preparacao de dados para export
│   │   ├── exportLeadsToExcel.ts  # Geracao de Excel formatado
│   │   ├── dateTime.ts            # Utilitarios de data (pt-BR, Sao Paulo)
│   │   └── utils.ts               # Helpers gerais (cn, clsx)
│   │
│   ├── contexts/                   # Contextos React
│   │   ├── AuthContext.tsx         # Estado de autenticacao + profile + permissoes
│   │   └── useAuth.ts             # Hook de acesso ao AuthContext
│   │
│   ├── types/                      # Definicoes TypeScript
│   │   ├── index.ts               # Lead, Profile, KanbanStage, etc.
│   │   ├── projects.ts            # ProjectRow, CompetitionRanking, etc.
│   │   └── leadAttachments.ts     # LeadAttachment type
│   │
│   └── __tests__/                  # 6 arquivos de teste
│       ├── crm-leads-pure.test.ts
│       ├── date-time.test.ts
│       ├── lead-attachments.test.ts
│       ├── lead-identifiers.test.ts
│       ├── lead-messages.test.ts
│       └── permissions.test.ts
│
├── supabase/
│   ├── config.toml                 # Configuracao do Supabase local
│   ├── migrations/                 # 11 arquivos de migracao SQL
│   │   ├── 20260424_audit_logs.sql
│   │   ├── 20260424_lead_notes_policies.sql
│   │   ├── 20260426_manual_leads.sql
│   │   ├── 20260427_projects_module.sql
│   │   ├── 20260428_n8n_chat_histories_read_policy.sql
│   │   ├── 20260428_security_hardening.sql
│   │   ├── 20260429_audit_logs_actor_scope.sql
│   │   ├── 20260429_lead_attachments.sql
│   │   ├── 20260430_profiles_update_notifications_policy.sql
│   │   └── 20260430_profiles_whatsapp_notifications.sql
│   │
│   └── functions/                  # 3 Edge Functions (Deno)
│       ├── manage-user/index.ts
│       ├── notify-lead-assignment/index.ts
│       ├── manual-lead-attachment/index.ts
│       └── _shared/cors.ts
│
├── public/                         # Assets estaticos (favicon, logos)
├── package.json
├── vite.config.ts
├── tsconfig.json
└── CLAUDE.md                       # Guidelines de desenvolvimento
```

---

## 4. Banco de Dados -- Tabelas e Schema

### Tabelas Principais

#### `profiles` -- Usuarios do CRM
| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid (PK) | ID do usuario (auth.users) |
| email | text | Email de login |
| nome | text | Nome completo |
| role | text | 'dono', 'admin' ou 'corretor' |
| ativo | boolean | Se o usuario esta ativo |
| whatsapp_number | text | Numero WhatsApp para notificacoes |
| notify_new_leads | boolean | Se recebe notificacao de novos leads |

#### `Agente_Base_EnergiaSolar` -- Leads (tabela fonte)
| Coluna | Tipo | Descricao |
|---|---|---|
| id | serial (PK) | ID do lead |
| remotejid | text | ID WhatsApp (phone@s.whatsapp.net) |
| numero | text | Telefone |
| nome_completo | text | Nome do lead |
| tipoimovel | text | Tipo de imovel |
| valorcontaenergia | text | Valor da conta de energia |
| conta | text | Se recebeu conta de energia |
| urgencia | text | Nivel de urgencia |
| telefone_confirmado | text | Se o telefone foi confirmado |
| cidade | text | Cidade |
| email | text | Email |
| telefone_contato | text | Telefone de contato |
| horario_preferido | text | Horario preferido de contato |
| status_conversa | text | Status da conversa com IA |
| campanha | text | Campanha de origem |
| origem | text | Canal de origem |
| lead_entry_type | text | 'meta_ads' ou 'manual' |
| manual_created_by | uuid | Quem criou manualmente |
| created_at | timestamptz | Data de criacao |

#### `crm_lead_state` -- Estado do lead no CRM
| Coluna | Tipo | Descricao |
|---|---|---|
| lead_id | text (PK) | Referencia ao lead |
| corretor_id | uuid | Corretor atribuido |
| stage_id | uuid | Etapa atual no Kanban |
| arquivado | boolean | Se esta arquivado |
| ia_paused | boolean | Se a IA esta pausada |
| followup_count | integer | Contagem de follow-ups |
| first_response_at | timestamptz | Data da primeira resposta |
| last_interaction_at | timestamptz | Data da ultima interacao |
| assigned_at | timestamptz | Data de atribuicao |

#### `projects` -- Projetos solares
| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid (PK) | ID do projeto |
| data | date | Data do projeto |
| cliente | text | Nome do cliente |
| marca | text | Marca dos equipamentos |
| valor_projeto | numeric(14,2) | Valor total do projeto |
| forma_pagamento | text | Forma de pagamento |
| valor_equipamentos | numeric(14,2) | Custo de equipamentos |
| valor_servico | numeric(14,2) | Custo de servico |
| custo_instalacao | numeric(14,2) | Custo de instalacao |
| lucro | numeric(14,2) | Lucro do projeto |
| percentual_margem | numeric(7,2) | Margem percentual |
| fechado | boolean | Se o projeto foi fechado |
| pago | boolean | Se foi pago |
| parecer_aprovado | boolean | Se o parecer foi aprovado |
| entregue | boolean | Se foi entregue |
| instalado | boolean | Se foi instalado |
| vendedor | text | Nome do vendedor |
| vendedor_id | uuid | ID do vendedor |
| cpf_cnpj | text | CPF/CNPJ do cliente |
| cidade | text | Cidade do projeto |
| modulos | integer | Qtde de modulos |
| microinversores | integer | Qtde de microinversores |
| w_de_cada_placa | integer | Potencia de cada placa |
| observacoes | text | Observacoes |
| origem_registro | text | 'manual', 'importado' ou 'api' |
| status | text | Status geral |
| ativo | boolean | Se esta ativo |
| created_at / updated_at | timestamptz | Timestamps |
| created_by / updated_by | uuid | Quem criou/atualizou |

#### `lead_attachments` -- Anexos de leads
| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid (PK) | ID do anexo |
| lead_id | uuid | Lead vinculado |
| session_id | text | Sessao WhatsApp |
| phone | text | Telefone |
| storage_bucket | text | Bucket (lead-attachments) |
| storage_path | text | Caminho no storage |
| file_name | text | Nome do arquivo |
| mime_type | text | Tipo MIME |
| file_size | bigint | Tamanho em bytes |
| attachment_type | text | 'conta_energia' |
| origem | text | 'whatsapp_n8n' ou 'manual_crm' |

#### `audit_logs` -- Logs de auditoria
| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid (PK) | ID do log |
| actor_user_id | uuid | Quem executou |
| actor_name_snapshot | text | Nome do ator |
| entity_type | text | Tipo da entidade |
| entity_id | text | ID da entidade |
| action | text | Acao executada |
| description | text | Descricao |
| before_data / after_data | jsonb | Estado antes/depois |
| created_at | timestamptz | Quando ocorreu |

#### Outras tabelas
- **`crm_lead_notes`** -- Notas internas dos leads (author_id, content, timestamps)
- **`crm_lead_activity`** -- Timeline de atividades (tipo, descricao, metadata)
- **`tags` / `crm_lead_tags`** -- Sistema de tags para leads
- **`n8n_chat_histories_nova`** -- Historico de conversa do chatbot via N8N
- **`lead_assignment_notifications`** -- Historico de notificacoes WhatsApp enviadas

---

## 5. Seguranca -- Row Level Security (RLS)

### Politicas de acesso por tabela

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| **profiles** | Self + admin/dono | -- | Dono full; Admin so corretor; Self notificacoes | -- |
| **projects** | Somente dono | Somente dono | Somente dono | Somente dono |
| **audit_logs** | Admin + dono | Authenticated (actor = self) | -- | -- |
| **crm_lead_notes** | Via can_access_crm_lead() | Author = self + acesso ao lead | Dono/admin OU author + acesso | Dono/admin OU author + acesso |
| **lead_attachments** | Ativo + acesso via lead/session/phone | -- | -- | -- |
| **n8n_chat_histories** | Via can_access_crm_chat_session() | -- | -- | -- |
| **lead_assignment_notifications** | Admin/dono OU seller = self | -- | -- | -- |
| **storage.objects** | Via can_access_lead_attachment_storage_object() | -- | -- | -- |

### Funcoes de seguranca do banco

| Funcao | Descricao |
|---|---|
| `current_active_role()` | Retorna role do usuario autenticado |
| `can_access_crm_lead(lead_id)` | Dono/admin = true; Corretor = so se e dono do lead |
| `can_access_crm_chat_session(session_id)` | Verifica acesso ao chat via remotejid normalizado |
| `can_access_crm_phone(phone)` | Normaliza telefone E164 e verifica acesso |
| `can_access_lead_attachment(lead_id, session_id, phone)` | Acesso composto por 3 caminhos |
| `can_access_lead_attachment_storage_object(bucket, path)` | Acesso a arquivo no storage |
| `normalize_crm_phone(phone)` | Normaliza para formato 55XXXXXXXXXXX |
| `build_crm_whatsapp_session_id(phone)` | Constroi JID WhatsApp |
| `prevent_admin_profile_escalation()` | Impede admin de escalar privilegios |

---

## 6. Edge Functions (Backend Serverless)

### `manage-user` -- Gestao de usuarios
- **Acoes:** `createUser` e `deleteUser`
- **Permissao:** Dono/admin (admin so gerencia corretores)
- **Fluxo de criacao:** Cria usuario no auth.users -> cria/atualiza profile -> retorna dados
- **Fluxo de exclusao:** Valida que nao ha leads atribuidos -> remove auth user + profile
- **Seguranca:** Validacao manual de JWT, prevencao de auto-exclusao, deteccao de email duplicado

### `notify-lead-assignment` -- Notificacoes WhatsApp
- **Eventos:** `assignment` (lead atribuido) e `returned_to_pool` (lead devolvido)
- **Cadeia de validacao:**
  1. Permissao do solicitante
  2. Lead existe e esta carregavel
  3. Vendedor existe, esta ativo, e role = corretor
  4. Vendedor tem notificacoes habilitadas
  5. Vendedor tem numero WhatsApp valido
  6. Nao ha notificacao duplicada nos ultimos 15 minutos
- **Provedor:** UAZAPI (envio de mensagem de texto via API)
- **Log:** Registra resultado (sent/failed/skipped) em lead_assignment_notifications

### `manual-lead-attachment` -- Upload de anexos
- **Aceita:** PDF, JPEG, PNG, WebP ate 10MB
- **Storage:** `lead-attachments/contas-energia/{phone}/{timestamp-uuid-filename}`
- **Tipo:** conta_energia (conta de energia)
- **Origem:** manual_crm
- **Limpeza:** Remove arquivo do storage se insert no banco falhar

---

## 7. Funcionalidades Completas

### 7.1 Gestao de Leads

| Funcionalidade | Descricao |
|---|---|
| **Captacao automatica** | Leads chegam via Meta Ads -> N8N -> WhatsApp chatbot -> tabela Agente_Base_EnergiaSolar |
| **Captacao manual** | Admin/corretor cria lead com formulario + upload de conta de energia |
| **Pool de leads** | Leads sem vendedor ficam no pool (visivel para admin/dono) |
| **Atribuicao** | Admin atribui lead a um corretor com notificacao WhatsApp automatica |
| **Kanban** | Corretor move leads entre etapas arrastando (desktop) ou selecionando (mobile) |
| **Detalhe do lead** | 4 abas: Dados, Acoes, Notas, Conversa |
| **Notas internas** | CRUD de notas por lead com controle de autoria |
| **Historico de conversa** | Visualizacao do chat do lead com o bot de IA (via N8N) |
| **Anexos** | Upload e visualizacao de contas de energia (PDF/imagem) |
| **Arquivamento** | Leads finalizados vao para arquivo, com possibilidade de desarquivar |
| **Devolucao ao pool** | Corretor pode devolver lead ao pool com notificacao |
| **Pausa de IA** | Pausar follow-ups automaticos do chatbot para um lead |
| **Busca global** | Cmd+K para buscar leads por nome, telefone ou cidade |
| **Tags** | Sistema de tags customizaveis por lead |

### 7.2 Kanban

| Funcionalidade | Descricao |
|---|---|
| **Colunas por etapa** | Cada etapa do funil e uma coluna (configuravel) |
| **Drag-and-drop** | @dnd-kit no desktop com overlay visual |
| **Fallback mobile** | Select dropdown no mobile em vez de drag |
| **Filtros** | Por corretor, data de criacao, status de IA |
| **Contagem por etapa** | Badge com quantidade de leads em cada coluna |
| **Cor por etapa** | Dot colorido no header de cada coluna |

### 7.3 Projetos (Modulo do Dono)

| Funcionalidade | Descricao |
|---|---|
| **CRUD completo** | Criar, editar, arquivar projetos |
| **Rastreamento financeiro** | Valor, equipamentos, servico, instalacao, lucro, margem |
| **Status pipeline** | Fechado, pago, parecer aprovado, entregue, instalado |
| **Filtros avancados** | Busca, vendedor, cidade, marca, status de pagamento |
| **Exportacao Excel** | Planilha formatada com 2 abas (dados + resumo) via ExcelJS |
| **Dados sensiveis** | Valores financeiros mascarados para nao-donos (MaskedValue) |

### 7.4 Competicao de Vendas

| Funcionalidade | Descricao |
|---|---|
| **Periodo** | Maio a Julho de 2026 |
| **Ranking** | Baseado em projetos pagos no periodo |
| **Metricas** | Quantidade, valor total, lucro |
| **Visualizacao** | Barras horizontais (BarList), badges de posicao |
| **Mascaramento** | Valores sensiveis mascarados para corretores |

### 7.5 Dashboard Gerencial

| Funcionalidade | Descricao |
|---|---|
| **Cards de metricas** | Total de leads, atribuidos, sem vendedor, com conta recebida, arquivados |
| **Ranking de vendedores** | Quantidade e valor por vendedor |
| **Resumo de projetos** | Status, cidades, marcas |
| **Privacy mode** | Toggle para mascarar dados financeiros (MaskedValue) |

### 7.6 Gestao de Equipe

| Funcionalidade | Descricao |
|---|---|
| **Criar usuario** | Via Edge Function manage-user (admin cria corretor, dono cria admin) |
| **Excluir usuario** | Com validacao de leads atribuidos e opcao de redistribuicao |
| **Ativar/inativar** | Toggle de status ativo |
| **WhatsApp** | Configurar numero WhatsApp para notificacoes |
| **Notificacoes** | Toggle de notificacao de novos leads |
| **Stats por membro** | Quantidade de leads por corretor |

### 7.7 Metricas e Logs

| Funcionalidade | Descricao |
|---|---|
| **Metricas de leads** | Por origem, por etapa, tempo de resposta |
| **Performance de corretores** | Cards individuais com metricas |
| **Filtro por periodo** | Selecao de intervalo de datas |
| **Logs de auditoria** | Toda acao rastreada: ator, acao, entidade, antes/depois |
| **Filtros de log** | Por usuario, lead, tipo de acao |

### 7.8 Notificacoes WhatsApp

| Funcionalidade | Descricao |
|---|---|
| **Atribuicao de lead** | Corretor recebe mensagem quando ganha um lead |
| **Devolucao ao pool** | Notificacao quando lead e devolvido |
| **Deduplicacao** | Janela de 15 minutos para evitar spam |
| **Historico** | Todas as notificacoes logadas (status, erro, resposta do provedor) |
| **Configuravel** | Corretor pode habilitar/desabilitar notificacoes |

---

## 8. Roteamento e Permissoes por Pagina

| Rota | Pagina | Permissao minima | Descricao |
|---|---|---|---|
| `/login` | Login | Publica | Autenticacao |
| `/` | PoolLeadsPage | Admin | Pool de leads (admin redireciona aqui, corretor vai para /kanban) |
| `/kanban` | KanbanPage | Corretor | Kanban pessoal do corretor |
| `/leads/novo` | ManualLeadPage | Corretor | Criacao manual de lead |
| `/leads/:id` | LeadDetailPage | Corretor (com scoping) | Detalhe do lead (corretor so ve os seus) |
| `/projetos` | ProjectsPage | Dono | Gestao de projetos |
| `/competicao` | CompetitionPage | Corretor | Ranking de competicao |
| `/dashboard-geral` | DashboardGeneralPage | Admin | Dashboard gerencial |
| `/metricas` | MetricsPage | Corretor | Metricas de performance |
| `/equipe` | TeamPage | Admin | Gestao de equipe |
| `/arquivados` | ArchivedLeadsPage | Admin | Leads arquivados |
| `/logs` | LogsPage | Admin | Logs de auditoria |

Todas as paginas usam lazy loading (`React.lazy`) com `Suspense` e skeleton de carregamento.

---

## 9. Gerenciamento de Estado

### Server State (TanStack React Query)
- **QueryClient** com staleTime de 5 minutos
- **Refetch on window focus** desabilitado
- Queries tipadas com `useQuery` para leitura
- Mutations com `useMutation` + invalidacao automatica de cache
- Usado em: leads, projetos, notas, atividades, mensagens, metricas

### Form State (React Hook Form + Zod)
- Validacao de schema com Zod
- Resolver de integracao HookForm + Zod
- Usado em: criacao de lead, criacao de usuario, edicao de projeto, notas

### Global State (React Context)
- **AuthContext**: usuario, sessao, profile, permissoes, loading
- **ThemeContext** (via next-themes): dark/light mode

### Local State (useState)
- Filtros de pagina
- Estado de dialogs
- UI temporario (loading, expanded, etc.)

---

## 10. Design System e Identidade Visual

### Paleta de cores (OKLch)
- **Primary:** `oklch(0.54 0.12 304)` -- roxo
- **Accent:** `oklch(0.86 0.11 92)` -- dourado
- **Background:** gradiente radial com primary (16%) e accent (8%)
- **Card:** superficies translucidas com `bg-card/92`
- **Sidebar:** escuro em `oklch(0.24)`

### Tokens CSS
- 65+ variaveis CSS para light e dark mode
- Escala de border-radius customizada (sm a 4xl)
- Classes utilitarias CRM: `crm-surface-panel`, `crm-badge-brand`, `crm-badge-highlight`, `crm-glow-primary`

### Componentes visuais
- Glass morphism (backdrop-blur, transparencias)
- Arredondamentos generosos (24-32px)
- Skeletons de carregamento
- Toasts com Sonner (top-right)
- Drag overlay com rotacao (1.5deg + shadow-2xl)
- Dark mode completo com transicao via classe `.dark`

### Tipografia
- **Fonte:** Inter Variable (@fontsource-variable)
- **Body:** text-sm (14px)
- **Headers:** text-xl a text-3xl
- **Labels:** text-xs (12px) uppercase tracking-wide

---

## 11. Testes

| Arquivo | O que testa |
|---|---|
| `crm-leads-pure.test.ts` | Logica de criacao e manipulacao de leads |
| `date-time.test.ts` | Formatacao de datas em pt-BR e fuso Sao Paulo |
| `lead-attachments.test.ts` | Validacao de MIME types, tamanho, paths |
| `lead-identifiers.test.ts` | Normalizacao de telefone e session_id WhatsApp |
| `lead-messages.test.ts` | Filtragem de mensagens de sistema |
| `permissions.test.ts` | Hierarquia de roles e funcoes de permissao |

**Framework:** Vitest com jsdom
**Resultado:** 63 testes passando em 6 suites

---

## 12. Fluxo de Dados -- Ciclo de Vida do Lead

```
Meta Ads (campanha)
        |
        v
   N8N (automacao)
        |
        v
WhatsApp (chatbot IA conversa com lead)
        |
        v
Agente_Base_EnergiaSolar (lead salvo no banco)
        |
        v
Pool de Leads (admin visualiza leads sem dono)
        |
        v
Atribuicao (admin atribui a corretor + notificacao WhatsApp)
        |
        v
Kanban do Corretor (lead aparece na primeira etapa)
        |
        v
Atendimento (corretor move entre etapas, adiciona notas, visualiza conversa)
        |
        v
[Fechamento] --> Projeto criado (dono registra no modulo de projetos)
        |
[Sem interesse] --> Arquivamento (lead vai para arquivo)
        |
[Reprocessar] --> Devolucao ao Pool (lead volta para redistribuicao)
```

---

## 13. Variaveis de Ambiente

| Variavel | Onde e usada | Descricao |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | URL da instancia Supabase |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Chave publica (anon) do Supabase |
| `SUPABASE_URL` | Edge Functions | URL interna do Supabase |
| `SUPABASE_ANON_KEY` | Edge Functions | Chave anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Chave de servico (privilegiada) |
| `UAZAPI_SEND_TEXT_URL` | Edge Function notify | URL da API UAZAPI |
| `UAZAPI_TOKEN` | Edge Function notify | Token de autenticacao UAZAPI |

---

## 14. Numeros do Projeto

| Metrica | Valor |
|---|---|
| Linhas de codigo (src/) | ~13.500 |
| Paginas/rotas | 12 |
| Componentes React | 46 |
| Modulos de logica (lib/) | 15 |
| Tabelas no banco | 12+ |
| Politicas RLS | 15+ |
| Funcoes SQL | 9 |
| Views SQL | 6 |
| Edge Functions | 3 |
| Migracoes SQL | 11 |
| Arquivos de teste | 6 (63 testes) |
| Dependencias de producao | 18 |
| Dependencias de desenvolvimento | 14 |

---

*Relatorio gerado por analise estatica do codigo-fonte. Nenhum arquivo do projeto foi modificado.*
