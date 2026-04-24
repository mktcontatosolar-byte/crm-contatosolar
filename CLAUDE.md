# CLAUDE.md

## 1. Visão geral do projeto

### Nome
`CRM Lançamento`

### O que é
SPA em React para operação de um CRM imobiliário focado em leads de lançamento. O produto centraliza:
- distribuição de leads para corretores
- acompanhamento por etapas do funil
- gestão de equipe administrativa e comercial
- histórico operacional e notas internas
- busca global de leads
- arquivamento e recuperação de leads

### Quem usa
- `admin`: gerencia equipe, distribui leads, acompanha métricas, acessa arquivados e faz ações privilegiadas
- `corretor`: acompanha o próprio Kanban, abre detalhe do lead e executa ações operacionais permitidas

## 2. Stack completa com versões exatas do `package.json`

### Dependências de runtime
- `@dnd-kit/core`: `^6.3.1`
- `@dnd-kit/sortable`: `^10.0.0`
- `@dnd-kit/utilities`: `^3.2.2`
- `@fontsource-variable/inter`: `^5.2.8`
- `@hookform/resolvers`: `^5.2.2`
- `@supabase/supabase-js`: `^2.104.1`
- `@tanstack/react-query`: `^5.100.1`
- `class-variance-authority`: `^0.7.1`
- `clsx`: `^2.1.1`
- `cmdk`: `^1.1.1`
- `date-fns`: `^4.1.0`
- `lucide-react`: `^1.9.0`
- `next-themes`: `^0.4.6`
- `radix-ui`: `^1.4.3`
- `react`: `^19.2.5`
- `react-dom`: `^19.2.5`
- `react-hook-form`: `^7.73.1`
- `react-router-dom`: `^7.14.2`
- `shadcn`: `^4.4.0`
- `sonner`: `^2.0.7`
- `tailwind-merge`: `^3.5.0`
- `tw-animate-css`: `^1.4.0`
- `zod`: `^4.3.6`

### Dependências de desenvolvimento
- `@eslint/js`: `^10.0.1`
- `@tailwindcss/vite`: `^4.2.4`
- `@types/node`: `^24.12.2`
- `@types/react`: `^19.2.14`
- `@types/react-dom`: `^19.2.3`
- `@vitejs/plugin-react`: `^6.0.1`
- `autoprefixer`: `^10.5.0`
- `eslint`: `^10.2.1`
- `eslint-plugin-react-hooks`: `^7.1.1`
- `eslint-plugin-react-refresh`: `^0.5.2`
- `globals`: `^17.5.0`
- `postcss`: `^8.5.10`
- `tailwindcss`: `^4.2.4`
- `typescript`: `~6.0.2`
- `typescript-eslint`: `^8.58.2`
- `vite`: `^8.0.10`

### Scripts
- `npm run dev`: inicia o Vite
- `npm run build`: `tsc -b && vite build`
- `npm run lint`: executa ESLint
- `npm run preview`: preview do bundle gerado

### Observações importantes de stack
- `TanStack Query` está instalado e usado em produção.
- `TanStack Table` não está presente no `package.json` atual e não deve ser documentado como dependência instalada.
- Os componentes de UI atuais são wrappers locais em `src/components/ui`, construídos sobre a base do ecossistema shadcn/Radix.

## 3. Arquitetura do projeto

### Fluxo principal
`Frontend React -> Supabase Auth/Database -> Edge Function manage-user`

### Camadas
- `src/`: aplicação frontend
- `src/lib/supabase.ts`: cliente padrão do Supabase usado pelo browser
- `src/contexts/AuthContext.tsx`: hidrata sessão, perfil e permissões do usuário
- `src/lib/manageUser.ts`: contrato tipado para chamar a Edge Function `manage-user`
- `supabase/functions/manage-user/index.ts`: camada segura para criação e exclusão de usuários no Auth admin

### Como as camadas se comunicam
- Leitura e escrita normal de dados usa `supabase.from(...).select/update/insert`
- Mutations e queries no frontend usam TanStack Query
- Operações privilegiadas de usuários usam `fetch` para `functions/v1/manage-user`
- A Edge Function valida o JWT do chamador, confirma que ele é admin ativo em `profiles` e só então usa `SUPABASE_SERVICE_ROLE_KEY`

### Controle de acesso
- Rotas privadas são protegidas em `src/App.tsx` por `PrivateRoute`
- O contexto de autenticação expõe `profile`, `session`, `isAdmin`, `signIn`, `signOut`, `refreshProfile`
- Páginas administrativas usam `adminOnly`

### Política de cache global
Configurada em `src/main.tsx`:
- `staleTime: 1000 * 60 * 5`
- `refetchOnWindowFocus: false`

## 4. Estrutura de pastas completa

```text
crm-lancamento/
├─ public/
│  ├─ favicon.svg                  # favicon do app
│  └─ icons.svg                    # sprites/ícones estáticos públicos
├─ src/
│  ├─ assets/
│  │  ├─ react.svg                 # asset padrão mantido no projeto
│  │  └─ vite.svg                  # asset padrão mantido no projeto
│  ├─ components/
│  │  ├─ crm/
│  │  │  ├─ PageIntro.tsx          # cabeçalho padrão de páginas internas
│  │  │  ├─ StatePanel.tsx         # estado vazio/erro/aviso
│  │  │  └─ StatCard.tsx           # card de métrica
│  │  ├─ ui/
│  │  │  ├─ avatar.tsx             # Avatar shadcn
│  │  │  ├─ badge.tsx              # Badge shadcn
│  │  │  ├─ button.tsx             # Button shadcn
│  │  │  ├─ card.tsx               # Card shadcn
│  │  │  ├─ command.tsx            # Command/CommandDialog
│  │  │  ├─ dialog.tsx             # Dialog
│  │  │  ├─ dropdown-menu.tsx      # DropdownMenu
│  │  │  ├─ input.tsx              # Input
│  │  │  ├─ label.tsx              # Label
│  │  │  ├─ select.tsx             # Select com portal/popper
│  │  │  ├─ sheet.tsx              # Sheet lateral/mobile
│  │  │  ├─ skeleton.tsx           # Skeleton com shimmer
│  │  │  ├─ sonner.tsx             # toaster do sonner
│  │  │  ├─ tabs.tsx               # Tabs
│  │  │  ├─ textarea.tsx           # Textarea
│  │  │  └─ tooltip.tsx            # Tooltip
│  │  ├─ GlobalLeadSearch.tsx      # busca global Ctrl+K
│  │  ├─ Layout.tsx                # shell principal com sidebar e header global
│  │  ├─ LeadDetailModal.tsx       # componente legado do modal antigo de lead
│  │  ├─ Sidebar.tsx               # navegação lateral e menu mobile
│  │  ├─ ThemeProvider.tsx         # provider de tema com next-themes
│  │  └─ ThemeToggle.tsx           # alternância de tema
│  ├─ contexts/
│  │  ├─ AuthContext.tsx           # sessão, perfil e permissões
│  │  └─ useAuth.ts                # hook de conveniência
│  ├─ lib/
│  │  ├─ leadActivity.ts           # registro e leitura de atividade do lead
│  │  ├─ manageUser.ts             # contrato do frontend com a Edge Function
│  │  ├─ supabase.ts               # cliente Supabase do browser
│  │  └─ utils.ts                  # helper `cn`
│  ├─ pages/
│  │  ├─ ArchivedLeadsPage.tsx     # listagem de leads arquivados
│  │  ├─ KanbanPage.tsx            # funil em colunas com drag and drop
│  │  ├─ LeadDetailPage.tsx        # detalhe do lead em página dedicada
│  │  ├─ Login.tsx                 # autenticação por email/senha
│  │  ├─ MetricsPage.tsx           # dashboard administrativo
│  │  ├─ PoolLeadsPage.tsx         # fila de leads não atribuídos
│  │  └─ TeamPage.tsx              # gestão de admins/corretores
│  ├─ types/
│  │  └─ index.ts                  # tipos principais do domínio
│  ├─ App.css                      # estilos adicionais do app
│  ├─ App.tsx                      # rotas e proteção de páginas
│  ├─ index.css                    # tokens visuais e estilos globais
│  └─ main.tsx                     # bootstrap React, QueryClient e providers
├─ supabase/
│  └─ functions/
│     ├─ _shared/
│     │  └─ cors.ts                # headers CORS compartilhados
│     └─ manage-user/
│        └─ index.ts               # Edge Function de criação/exclusão de usuário
├─ components.json                 # configuração do shadcn/ui
├─ eslint.config.js                # config ESLint flat
├─ index.html                      # shell HTML do Vite
├─ package-lock.json               # lockfile npm
├─ package.json                    # dependências e scripts
├─ README.md                       # documentação de uso do projeto
├─ tsconfig.app.json               # TS do frontend
├─ tsconfig.json                   # TS raiz
├─ tsconfig.node.json              # TS para ambiente node/vite
├─ vite.config.ts                  # alias `@` e plugins do Vite
└─ CLAUDE.md                       # este documento
```

## 5. Tabelas do Supabase

### Regra de documentação
Este documento só descreve com precisão o que aparece no código rastreado do projeto. Quando o frontend não modela colunas de uma tabela, isso é indicado explicitamente.

### `profiles`
Propósito:
- perfil operacional do usuário autenticado
- define nome, papel e status ativo

Colunas inferidas do código:
- `id: uuid` — mesmo identificador usado no Auth
- `email: text | null`
- `nome: text | null`
- `role: 'admin' | 'corretor'`
- `ativo: boolean`
- `created_at: timestamptz`
- `updated_at: timestamptz | null`

Relacionamentos inferidos:
- `profiles.id` <-> `auth.users.id`
- `leads_lancamento.corretor_id -> profiles.id`
- `lead_notes.author_id -> profiles.id`
- `lead_activity.usuario_id -> profiles.id`

### `leads_lancamento`
Propósito:
- entidade principal de lead operado pelo CRM

Colunas inferidas do código:
- `id: uuid`
- `remotejid: text`
- `numero: text | null`
- `nome_completo: text | null`
- `email: text | null`
- `telefone_contato: text | null`
- `horario_preferido: text | null`
- `tem_nome: boolean`
- `tem_email: boolean`
- `tem_telefone: boolean`
- `tem_horario: boolean`
- `status_conversa: text`
- `campanha: text | null`
- `origem: text | null`
- `outra_info: text | null`
- `corretor_id: uuid | null`
- `assumed_at: timestamptz | null`
- `stage_id: uuid | null`
- `arquivado: boolean`
- `ia_paused: boolean`
- `followup_count: integer`
- `first_response_at: timestamptz`
- `last_interaction_at: timestamptz`
- `created_at: timestamptz`

Relacionamentos inferidos:
- `corretor_id -> profiles.id`
- `stage_id -> kanban_stages.id`
- `lead_notes.lead_id -> leads_lancamento.id`
- `lead_activity.lead_id -> leads_lancamento.id`
- `chat_history.lead_id -> leads_lancamento.id`
- `lead_tags.lead_id -> leads_lancamento.id`

### `kanban_stages`
Propósito:
- define colunas/etapas do funil

Colunas inferidas do código:
- `id: uuid`
- `nome: text`
- `ordem: integer`
- `cor: text`
- `is_final: boolean`

Relacionamentos inferidos:
- `leads_lancamento.stage_id -> kanban_stages.id`

### `lead_notes`
Propósito:
- notas internas escritas pela equipe no detalhe do lead

Colunas inferidas do código:
- `id: uuid`
- `lead_id: uuid`
- `author_id: uuid`
- `content: text`
- `created_at: timestamptz`

Relacionamentos inferidos:
- `lead_id -> leads_lancamento.id`
- `author_id -> profiles.id`

### `lead_activity`
Propósito:
- trilha operacional de ações feitas em um lead

Colunas inferidas do código:
- `id: uuid`
- `lead_id: uuid`
- `usuario_id: uuid | null`
- `tipo: text`
- `descricao: text`
- `metadata: jsonb | null`
- `created_at: timestamptz`

Relacionamentos inferidos:
- `lead_id -> leads_lancamento.id`
- `usuario_id -> profiles.id`

Tipos atualmente usados:
- `atribuicao`
- `pool`
- `etapa`
- `arquivamento`
- `desarquivamento`
- `ia`

### `lead_tags`
Propósito:
- relação N:N entre leads e tags

Colunas inferidas do código:
- `lead_id: uuid`
- `tag_id: uuid`

Relacionamentos inferidos:
- `lead_id -> leads_lancamento.id`
- `tag_id -> tags.id`

### `tags`
Propósito:
- catálogo de tags aplicáveis a leads

Colunas inferidas do código:
- `id: uuid`
- `nome: text`
- `cor: text`
- `created_by: uuid | null`

Relacionamentos inferidos:
- `created_by -> profiles.id`
- `lead_tags.tag_id -> tags.id`

### `chat_history`
Propósito:
- conversa do lead exibida na aba `Conversa`

Colunas inferidas do código:
- `id: uuid`
- `lead_id: uuid`
- `role: 'user' | 'bot'`
- `content: text`
- `created_at: timestamptz`

Relacionamentos inferidos:
- `lead_id -> leads_lancamento.id`

### `historico_mensagens`
Propósito:
- tabela existente no ambiente, citada como parte do domínio de mensagens

Status da documentação:
- não há query, tipo TS nem select explícito dessa tabela no frontend atual
- colunas, tipos e relacionamentos não são inferíveis com segurança a partir do código rastreado

### `imoveis`
Propósito:
- tabela existente no ambiente para cadastro de imóveis

Status da documentação:
- não há query, tipo TS nem select explícito dessa tabela no frontend atual
- colunas, tipos e relacionamentos não são inferíveis com segurança a partir do código rastreado

### `documents`
Propósito:
- tabela existente no ambiente para documentos

Status da documentação:
- não há query, tipo TS nem select explícito dessa tabela no frontend atual
- colunas, tipos e relacionamentos não são inferíveis com segurança a partir do código rastreado

### `custo_tokens`
Propósito:
- tabela existente no ambiente para custo/consumo de IA

Status da documentação:
- não há query, tipo TS nem select explícito dessa tabela no frontend atual
- colunas, tipos e relacionamentos não são inferíveis com segurança a partir do código rastreado

### `n8n_chat_histories_sdr`
Propósito:
- tabela existente no ambiente para histórico do SDR do n8n

Status da documentação:
- não há query, tipo TS nem select explícito dessa tabela no frontend atual
- colunas, tipos e relacionamentos não são inferíveis com segurança a partir do código rastreado

## 6. Edge Functions existentes

### `manage-user`
Arquivo:
- `supabase/functions/manage-user/index.ts`

Objetivo:
- criação segura de usuário
- exclusão segura de usuário
- bloqueio de autoexclusão
- bloqueio de exclusão quando corretor ainda tem leads ativos

Endpoint:
- `POST ${VITE_SUPABASE_URL}/functions/v1/manage-user`

Headers esperados:
- `Authorization: Bearer <access_token>`
- `apikey: <VITE_SUPABASE_ANON_KEY>`
- `Content-Type: application/json`

Secrets obrigatórios na function:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Contrato: `createUser`
Payload:
```json
{
  "action": "createUser",
  "email": "corretor@empresa.com",
  "password": "senha-segura",
  "nome": "Nome do usuário",
  "role": "admin",
  "ativo": true
}
```

Fluxo:
- valida payload
- valida sessão do chamador
- valida que o chamador é admin ativo
- cria usuário em `auth.users`
- confirma email automaticamente (`email_confirm: true`)
- faz `upsert` em `profiles`
- se o `upsert` falhar, remove o usuário recém-criado do Auth

Resposta de sucesso:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "corretor@empresa.com"
  },
  "profile": {
    "id": "uuid",
    "email": "corretor@empresa.com",
    "nome": "Nome do usuário",
    "role": "admin",
    "ativo": true
  }
}
```

### Contrato: `deleteUser`
Payload:
```json
{
  "action": "deleteUser",
  "userId": "uuid"
}
```

Fluxo:
- valida payload
- valida sessão do chamador
- valida que o chamador é admin ativo
- bloqueia autoexclusão
- consulta `leads_lancamento` para impedir exclusão de corretor com leads ativos não arquivados
- executa `auth.admin.deleteUser(userId, false)`
- remove o registro correspondente de `profiles`

Resposta de sucesso:
```json
{
  "success": true,
  "deletedUserId": "uuid",
  "warning": null
}
```

Resposta possível com aviso:
```json
{
  "success": true,
  "deletedUserId": "uuid",
  "warning": "Usuário removido do Auth, mas o profile exigirá limpeza manual."
}
```

### Códigos de erro explícitos hoje
- `missing_authorization`
- `invalid_session`
- `profile_lookup_failed`
- `forbidden`
- `invalid_payload`
- `invalid_role`
- `auth_create_failed`
- `profile_upsert_failed`
- `self_delete_blocked`
- `lead_check_failed`
- `assigned_leads_block`
- `auth_delete_failed`
- `invalid_json`
- `unknown_action`

## 7. Regras de segurança obrigatórias
- `SUPABASE_SERVICE_ROLE_KEY` nunca pode aparecer no frontend
- RLS deve permanecer ativa em todas as tabelas
- operações privilegiadas de usuário devem passar por Edge Function
- senhas nunca são armazenadas em tabela de aplicação
- validação de permissão não pode depender apenas do frontend
- `profiles.id` deve permanecer alinhado com `auth.users.id`

## 8. Padrões de código obrigatórios
- TypeScript estrito; não introduzir `any` ou `ts-ignore`
- todo formulário novo deve usar `react-hook-form` + `zod`
- todo fetch/mutation novo deve usar TanStack Query quando for fluxo de tela
- invalidar queries relacionadas após toda mutation
- componentes de UI devem vir de `src/components/ui` com padrão shadcn
- ícones sempre via `lucide-react`
- toasts sempre via `sonner`
- datas e tempos relativos sempre via `date-fns` com locale `pt-BR`
- evitar HTML cru sem estilo padronizado
- helpers reutilizáveis devem ir para `src/lib`
- tipos compartilhados devem ir para `src/types/index.ts`

## 9. Padrões de UX obrigatórios
- loading state em botões durante chamadas assíncronas
- dialog de confirmação antes de ação destrutiva
- toast de sucesso e erro após operação relevante
- skeleton durante carregamento de listas e painéis
- mobile responsivo em qualquer componente alterado
- alvos de toque com mínimo prático de `48px` no mobile
- estados vazios com mensagem útil
- manter hierarquia visual consistente com a identidade laranja + azul escuro

## 10. Fluxos principais implementados

### Autenticação
- login por email/senha em `Login.tsx`
- sessão carregada pelo `AuthContext`
- perfil buscado em `profiles`
- rotas privadas protegidas por `PrivateRoute`
- logout via `signOut`

### Pool de Leads
- tela raiz `/`
- lista leads não atribuídos
- layout mestre-detalhe no desktop
- detalhe em `Sheet` no mobile
- permite atribuir corretor com confirmação
- registra atividade `atribuicao`
- botão `Ver detalhes` navega para `/leads/:id`

### Kanban
- rota `/kanban`
- colunas carregadas de `kanban_stages`
- drag and drop no desktop com `@dnd-kit`
- select de fallback no mobile
- filtros por corretor, data de criação, IA e origem
- opção de devolver para pool por card
- registra atividade `etapa` e `pool`
- mover para etapa final não arquiva automaticamente

### Equipe
- rota `/equipe`
- cria admin/corretor via Edge Function
- ativa/inativa usuário direto em `profiles`
- exclui usuário via Edge Function
- redistribui leads do corretor de volta ao pool
- usa RHF + Zod no formulário
- usa dialogs de confirmação e toasts

### Busca global
- acessível de qualquer tela pelo layout
- abre com clique ou `Ctrl+K`
- busca por nome, email e telefone em `leads_lancamento`
- mostra avatar, status e corretor
- navega para `/leads/:id`

### Histórico de atividade
- gravado em `lead_activity`
- hoje registra:
  - atribuição
  - devolução ao pool
  - mudança de etapa
  - arquivamento
  - desarquivamento
  - pausa/reativação de IA
- exibido na aba `Conversa` do detalhe do lead

### Arquivados
- rota `/arquivados`
- lista leads com `arquivado = true`
- ação `Desarquivar` devolve ao pool:
  - `arquivado = false`
  - `corretor_id = null`
  - `assumed_at = null`
  - `stage_id = null`
- registra atividade `desarquivamento`

### Página de detalhe do lead
- rota `/leads/:id`
- header fixo com avatar e badges
- abas:
  - `Dados`
  - `Ações`
  - `Notas`
  - `Conversa`
- ações disponíveis:
  - pausar/reativar IA
  - devolver ao pool
  - arquivar
- notas salvas em `lead_notes`
- conversa lida de `chat_history`
- timeline operacional lida de `lead_activity`

## 11. Variáveis de ambiente

### Frontend
- `VITE_SUPABASE_URL`
  - URL do projeto Supabase usada pelo browser
- `VITE_SUPABASE_ANON_KEY`
  - chave pública usada pelo cliente frontend

### Edge Function `manage-user`
- `SUPABASE_URL`
  - URL do projeto Supabase para uso interno da function
- `SUPABASE_ANON_KEY`
  - usada na validação do usuário chamador
- `SUPABASE_SERVICE_ROLE_KEY`
  - usada apenas no servidor para `auth.admin.*`

## 12. Regras de commit
- sempre rodar `npm run lint` e `npm run build` antes de commitar
- mensagem de commit em inglês, curta e descritiva
- fazer push ao final quando a tarefa pedir entrega completa
- evitar commitar arquivos temporários, locais ou não rastreados do ambiente do agente

## 13. O que NUNCA fazer
- expor `SUPABASE_SERVICE_ROLE_KEY` no frontend
- desativar RLS para “resolver rápido”
- armazenar senha em tabela de aplicação
- trocar componente shadcn por HTML cru sem padrão visual
- quebrar tipos TypeScript existentes
- fazer push sem `lint` e `build` passarem
- inventar schema de tabela sem confirmar no código ou no banco
