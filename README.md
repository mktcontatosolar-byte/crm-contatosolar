# Contato Solar CRM

CRM imobiliario operacional para distribuicao de leads, acompanhamento comercial por etapa, gestao de equipe e leitura detalhada do historico de cada lead.

## Visao geral

O projeto foi finalizado como uma SPA em React + TypeScript conectada ao Supabase. O sistema atende dois perfis:

- `admin`: gerencia pool, equipe, metricas, arquivados e a operacao geral
- `corretor`: opera o proprio Kanban e acessa os detalhes dos leads atribuidos

Principais entregas do produto:

- autenticacao com Supabase Auth
- controle de acesso por perfil
- pool de leads para atribuicao manual
- pagina Meu Kanban com layout operacional completo
- drag and drop no desktop e seletor no mobile
- pagina de detalhe do lead com dados, acoes, notas e conversa
- timeline de atividade operacional
- busca global de leads com `Ctrl+K`
- gestao de equipe com Edge Function segura
- pagina de metricas administrativas
- listagem de leads arquivados com retorno ao fluxo

## Stack

Base:

- React 19
- TypeScript
- Vite

Dados, auth e backend:

- Supabase Auth
- Supabase Database
- Supabase Edge Functions
- Row Level Security

Estado e formularios:

- TanStack Query
- React Hook Form
- Zod

UI:

- Tailwind CSS v4
- shadcn/ui
- Radix UI
- lucide-react
- sonner
- date-fns
- dnd-kit
- next-themes

## Telas principais

### Login

Entrada por email e senha com carregamento de sessao, fallback visual e redirecionamento por papel.

### Pool de Leads

Rota principal do admin. Lista leads sem corretor e permite atribuir rapidamente para um corretor ativo, com confirmacao e registro de atividade.

### Meu Kanban

Rota operacional do corretor e tambem disponivel para admin. O layout final entregue inclui:

- header compacto com titulo, badge e contador de leads ativos
- filtros inline no desktop
- colunas horizontais com scroll lateral
- scroll vertical independente em cada etapa
- cards mais limpos com origem destacada
- acesso rapido a detalhes e redistribuicao

### Detalhe do Lead

Pagina dedicada em `/leads/:id` com:

- dados do lead
- acoes operacionais
- notas internas
- conversa e historico operacional

### Equipe

Tela administrativa para:

- criar usuario admin ou corretor
- ativar e inativar usuarios
- excluir usuarios com seguranca
- devolver carteira de um corretor ao pool

### Metricas

Dashboard administrativo com KPIs e distribuicoes operacionais do funil.

### Arquivados

Lista leads arquivados e permite desarquivar devolvendo o lead ao pool.

## Rotas

- `/login`
- `/`
  Admin apenas. Pool de Leads.
- `/kanban`
  Kanban operacional.
- `/leads/:id`
  Detalhe do lead.
- `/equipe`
  Gestao de equipe.
- `/metricas`
  Dashboard administrativo.
- `/arquivados`
  Leads arquivados.

## Fluxo de produto

1. O lead entra em `leads_lancamento`.
2. O admin ve o lead no Pool e atribui a um corretor.
3. O corretor passa a operar o lead no Kanban.
4. Mudancas de etapa, devolucao ao pool, arquivamento e status de IA geram atividade operacional.
5. O detalhe do lead centraliza leitura, notas, conversa e acoes.
6. Leads finalizados podem ser arquivados e reabertos quando necessario.

## Estrutura do projeto

```text
contato-solar-crm/
|-- public/
|-- src/
|   |-- assets/
|   |-- components/
|   |   |-- crm/
|   |   |-- ui/
|   |   |-- GlobalLeadSearch.tsx
|   |   |-- Layout.tsx
|   |   |-- LeadDetailModal.tsx
|   |   |-- Sidebar.tsx
|   |   |-- ThemeProvider.tsx
|   |   `-- ThemeToggle.tsx
|   |-- contexts/
|   |   |-- AuthContext.tsx
|   |   `-- useAuth.ts
|   |-- lib/
|   |   |-- leadActivity.ts
|   |   |-- manageUser.ts
|   |   |-- supabase.ts
|   |   `-- utils.ts
|   |-- pages/
|   |   |-- ArchivedLeadsPage.tsx
|   |   |-- KanbanPage.tsx
|   |   |-- LeadDetailPage.tsx
|   |   |-- Login.tsx
|   |   |-- MetricsPage.tsx
|   |   |-- PoolLeadsPage.tsx
|   |   `-- TeamPage.tsx
|   |-- types/
|   |   `-- index.ts
|   |-- App.tsx
|   |-- App.css
|   |-- index.css
|   `-- main.tsx
|-- supabase/
|   |-- functions/
|   |   |-- _shared/cors.ts
|   |   `-- manage-user/index.ts
|   `-- migrations/
|       |-- 20260424_lead_notes_policies.sql
|       `-- 20260424_lead_notes_update_delete_policies.sql
|-- CLAUDE.md
|-- README.md
|-- package.json
`-- vite.config.ts
```

## Supabase

Tabelas usadas diretamente pelo app:

- `profiles`
- `leads_lancamento`
- `kanban_stages`
- `lead_notes`
- `lead_activity`
- `lead_tags`
- `tags`
- `chat_history`

Tabelas citadas no dominio, mas nao modeladas diretamente no frontend atual:

- `historico_mensagens`
- `imoveis`
- `documents`
- `custo_tokens`
- `n8n_chat_histories_sdr`

## Edge Function

### `manage-user`

Responsavel por operacoes privilegiadas de usuario que nao podem acontecer apenas no browser.

Funcoes atuais:

- criar usuario no Auth
- criar ou atualizar `profiles`
- excluir usuario do Auth
- remover `profiles`
- impedir autoexclusao
- impedir exclusao de corretor com leads ativos

Endpoint:

```text
POST ${VITE_SUPABASE_URL}/functions/v1/manage-user
```

## Variaveis de ambiente

Frontend:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

Edge Function `manage-user`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Como rodar localmente

1. Instale as dependencias.

```bash
npm install
```

2. Configure o `.env`.

3. Rode o app.

```bash
npm run dev
```

4. Valide antes de commitar.

```bash
npm run lint
npm run build
```

## Deploy

Fluxo esperado:

`GitHub -> main -> Netlify`

Configuracao atual:

- build command: `npm run build`
- publish directory: `dist`

## Decisoes tecnicas importantes

- Supabase concentra auth, banco, RLS e backend serverless.
- Operacoes administrativas sensiveis passam por Edge Function.
- O detalhe do lead saiu do modal grande e foi consolidado em rota dedicada.
- O Kanban usa drag and drop no desktop, mas preserva seletor no mobile para estabilidade.
- O app prioriza operacao diaria: filtros rapidos, cards compactos, feedback visual e navegacao objetiva.

## Seguranca

- nunca expor `SUPABASE_SERVICE_ROLE_KEY` no frontend
- manter RLS ativa
- nao confiar em permissao apenas no client
- nao armazenar senha em tabela da aplicacao
- alinhar `profiles.id` com `auth.users.id`

## Checklist de manutencao

Antes de qualquer entrega:

```bash
npm run lint
npm run build
```

Boas praticas:

- commits curtos e descritivos em ingles
- nao commitar arquivos locais do ambiente
- validar o schema real antes de documentar colunas novas
