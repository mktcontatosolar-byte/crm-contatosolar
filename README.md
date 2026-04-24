# CRM Lançamento

CRM imobiliário para operação de leads, distribuição entre corretores, acompanhamento do funil de vendas e gestão administrativa da equipe.

## 1. O projeto

`CRM Lançamento` é uma SPA em React + TypeScript conectada ao Supabase. O sistema atende dois perfis:
- `admin`: distribui leads, gerencia equipe, acompanha métricas, acessa arquivados e controla o funil
- `corretor`: acompanha leads atribuídos no Kanban e executa ações operacionais

O produto já implementa:
- login com Supabase Auth
- pool de leads com atribuição de corretor
- Kanban com drag and drop no desktop
- detalhe de lead em página dedicada
- notas internas e conversa
- histórico de atividade operacional
- gestão de equipe via Edge Function segura
- busca global com `Ctrl+K`
- listagem de leads arquivados

## 2. Descrição visual das telas principais

### Login
Tela de autenticação com card centralizado, identidade visual do CRM e feedback de erro/sucesso via toast.

### Pool de Leads
Tela em formato mestre-detalhe:
- lista de leads na esquerda
- painel de detalhes na direita no desktop
- `Sheet` no mobile
- atribuição de corretor com confirmação

### Meu Kanban
Colunas horizontais com etapas do funil:
- drag and drop no desktop
- select de fallback no mobile
- filtros por corretor, data, IA e origem
- ações por card, inclusive devolução ao pool

### Equipe
Dashboard administrativo para:
- criar admin/corretor
- ativar/inativar usuários
- excluir usuários
- redistribuir leads de um corretor

### Métricas
Dashboard administrativo com KPIs e gráficos visuais em SVG para acompanhar volume, distribuição e ritmo operacional.

### Detalhe do Lead
Página dedicada `/leads/:id` com header fixo e abas:
- `Dados`
- `Ações`
- `Notas`
- `Conversa`

### Arquivados
Lista separada de leads arquivados com ação de desarquivar e devolver ao pool.

## 3. Stack completa

### Base
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)

### Dados, autenticação e backend
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [RLS no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Estado de servidor e formulários
- [TanStack Query](https://tanstack.com/query/latest)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [@hookform/resolvers](https://github.com/react-hook-form/resolvers)

### UI
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [lucide-react](https://lucide.dev/)
- [sonner](https://sonner.emilkowal.ski/)
- [date-fns](https://date-fns.org/)
- [@dnd-kit](https://dndkit.com/)
- [next-themes](https://github.com/pacocoursey/next-themes)

### Notas de stack
- O projeto usa `@tanstack/react-query` hoje.
- `@tanstack/react-table` não está instalado no `package.json` atual.
- A base visual é `shadcn` com wrappers locais em `src/components/ui`.

## 4. Pré-requisitos

- `Node.js` 20+ recomendado
- `npm`
- projeto Supabase configurado
- variáveis de ambiente do frontend definidas
- Edge Function `manage-user` deployada se a funcionalidade de equipe precisar operar localmente contra o ambiente remoto

## 5. Como rodar localmente

### 1. Instalar dependências
```bash
npm install
```

### 2. Criar `.env`
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

### 3. Subir o frontend
```bash
npm run dev
```

### 4. Validar qualidade antes de commitar
```bash
npm run lint
npm run build
```

## 6. Variáveis de ambiente

### Frontend
- `VITE_SUPABASE_URL`
  - URL pública do projeto Supabase
- `VITE_SUPABASE_ANON_KEY`
  - chave pública usada pelo browser

### Edge Function `manage-user`
Essas variáveis não ficam no frontend, mas precisam existir no Supabase:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 7. Estrutura de pastas comentada

```text
crm-lancamento/
├─ public/                         # ícones públicos
├─ src/
│  ├─ assets/                      # assets estáticos mantidos no projeto
│  ├─ components/
│  │  ├─ crm/                      # componentes de produto: intro, stat cards, painéis de estado
│  │  ├─ ui/                       # wrappers shadcn/ui usados no app
│  │  ├─ GlobalLeadSearch.tsx      # busca global Ctrl+K
│  │  ├─ Layout.tsx                # shell com sidebar e header global
│  │  ├─ LeadDetailModal.tsx       # componente legado do modal antigo
│  │  ├─ Sidebar.tsx               # menu lateral e navegação mobile
│  │  ├─ ThemeProvider.tsx         # provider de tema
│  │  └─ ThemeToggle.tsx           # alternância de tema
│  ├─ contexts/
│  │  ├─ AuthContext.tsx           # sessão, perfil, login, logout, permissão
│  │  └─ useAuth.ts                # hook auxiliar
│  ├─ lib/
│  │  ├─ leadActivity.ts           # helpers de atividade operacional do lead
│  │  ├─ manageUser.ts             # contrato da Edge Function manage-user
│  │  ├─ supabase.ts               # cliente Supabase do frontend
│  │  └─ utils.ts                  # helper `cn`
│  ├─ pages/
│  │  ├─ ArchivedLeadsPage.tsx     # leads arquivados
│  │  ├─ KanbanPage.tsx            # funil operacional
│  │  ├─ LeadDetailPage.tsx        # detalhe do lead
│  │  ├─ Login.tsx                 # autenticação
│  │  ├─ MetricsPage.tsx           # dashboard administrativo
│  │  ├─ PoolLeadsPage.tsx         # leads sem corretor
│  │  └─ TeamPage.tsx              # gestão de equipe
│  ├─ types/
│  │  └─ index.ts                  # tipos do domínio
│  ├─ App.tsx                      # rotas
│  ├─ index.css                    # estilos globais
│  └─ main.tsx                     # bootstrap da aplicação
├─ supabase/
│  └─ functions/
│     ├─ _shared/cors.ts           # CORS compartilhado
│     └─ manage-user/index.ts      # Edge Function segura para create/delete user
├─ components.json                 # config do shadcn/ui
├─ eslint.config.js                # lint
├─ package.json                    # scripts e dependências
├─ README.md                       # este arquivo
├─ CLAUDE.md                       # regras permanentes do projeto
└─ vite.config.ts                  # config do Vite e alias @
```

## 8. Tabelas do Supabase e propósito

### Tabelas usadas diretamente pelo frontend atual
- `leads_lancamento`
  - tabela principal de leads do funil
- `profiles`
  - perfil operacional dos usuários
- `kanban_stages`
  - etapas do Kanban
- `lead_notes`
  - notas internas do lead
- `lead_activity`
  - histórico operacional do lead
- `lead_tags`
  - relação entre leads e tags
- `tags`
  - catálogo de tags
- `chat_history`
  - histórico de conversa do lead

### Tabelas existentes no ambiente e citadas no domínio
- `historico_mensagens`
  - armazenamento de mensagens do ecossistema
- `imoveis`
  - cadastro de imóveis
- `documents`
  - documentos relacionados ao negócio
- `custo_tokens`
  - controle de custos/uso de IA
- `n8n_chat_histories_sdr`
  - histórico do SDR no n8n

### Colunas hoje modeladas no frontend

#### `profiles`
- `id`
- `email`
- `nome`
- `role`
- `ativo`
- `created_at`
- `updated_at`

#### `leads_lancamento`
- `id`
- `remotejid`
- `numero`
- `nome_completo`
- `email`
- `telefone_contato`
- `horario_preferido`
- `tem_nome`
- `tem_email`
- `tem_telefone`
- `tem_horario`
- `status_conversa`
- `campanha`
- `origem`
- `outra_info`
- `corretor_id`
- `assumed_at`
- `stage_id`
- `arquivado`
- `ia_paused`
- `followup_count`
- `first_response_at`
- `last_interaction_at`
- `created_at`

#### `kanban_stages`
- `id`
- `nome`
- `ordem`
- `cor`
- `is_final`

#### `lead_notes`
- `id`
- `lead_id`
- `author_id`
- `content`
- `created_at`

#### `lead_activity`
- `id`
- `lead_id`
- `usuario_id`
- `tipo`
- `descricao`
- `metadata`
- `created_at`

#### `lead_tags`
- `lead_id`
- `tag_id`

#### `tags`
- `id`
- `nome`
- `cor`
- `created_by`

#### `chat_history`
- `id`
- `lead_id`
- `role`
- `content`
- `created_at`

### Nota de precisão
As demais tabelas listadas acima existem no ambiente do projeto, mas suas colunas não estão modeladas nem consultadas explicitamente no frontend atual. Para alterações de schema, confirme no Supabase antes de editar.

## 9. Edge Functions

### `manage-user`

Objetivo:
- criar usuários no Auth de forma segura
- excluir usuários do Auth de forma segura
- manter `profiles` sincronizado

Endpoint:
```text
POST ${VITE_SUPABASE_URL}/functions/v1/manage-user
```

Headers:
```http
Authorization: Bearer <access_token>
apikey: <VITE_SUPABASE_ANON_KEY>
Content-Type: application/json
```

### Payload para criação
```json
{
  "action": "createUser",
  "email": "corretor@empresa.com",
  "password": "senha-segura",
  "nome": "Nome do usuário",
  "role": "corretor",
  "ativo": true
}
```

### Payload para exclusão
```json
{
  "action": "deleteUser",
  "userId": "uuid"
}
```

### Resposta esperada em sucesso
Criação:
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
    "role": "corretor",
    "ativo": true
  }
}
```

Exclusão:
```json
{
  "success": true,
  "deletedUserId": "uuid",
  "warning": null
}
```

### Erros de negócio tratados pela function
- usuário sem header de autorização
- sessão inválida
- usuário sem papel `admin`
- payload inválido
- papel inválido
- autoexclusão bloqueada
- exclusão bloqueada quando corretor possui leads ativos
- falha ao criar no Auth
- falha ao remover no Auth
- falha ao gravar/remover `profiles`

## 10. Fluxo de deploy

Fluxo atual esperado:
`GitHub -> branch main -> Netlify -> build automático`

### Configuração operacional
- branch de deploy: `main`
- build command: `npm run build`
- publish directory: `dist`
- push na `main` dispara novo deploy

## 11. Decisões arquiteturais importantes

### Supabase como backend único
Motivo:
- reduz complexidade operacional
- centraliza Auth, banco, RLS e Edge Functions no mesmo ecossistema

### Edge Function para operações admin
Motivo:
- `SERVICE_ROLE_KEY` não pode ir para o frontend
- criação/exclusão de usuário exige privilégio de admin do Auth

### TanStack Query como padrão de dados
Motivo:
- cache consistente
- invalidação simples após mutation
- melhor UX com loading, refetch controlado e estado previsível

### Página dedicada para detalhe do lead
Motivo:
- o modal antigo ficou grande e ruim para mobile
- a rota `/leads/:id` melhora navegação, leitura e manutenção

### Drag and drop no desktop e select no mobile
Motivo:
- drag and drop melhora produtividade no desktop
- select continua mais confiável no toque

### Busca global como command palette
Motivo:
- acelera acesso a qualquer lead sem navegar por telas
- `Ctrl+K` melhora ergonomia operacional

### Histórico de atividade separado da conversa
Motivo:
- distingue ações humanas/sistêmicas da conversa textual com o lead
- deixa auditoria operacional visível no detalhe do lead

## 12. Segurança

- `SERVICE_ROLE_KEY` nunca no frontend
- RLS deve permanecer ativa
- operações admin sempre via Edge Function
- senhas nunca em tabela da aplicação
- frontend usa apenas `VITE_SUPABASE_ANON_KEY` + JWT da sessão

## 13. Checklist rápido de desenvolvimento

Antes de commitar:
```bash
npm run lint
npm run build
```

Padrão de commit:
- mensagem em inglês
- curta e descritiva

Entrega final:
- commit
- push
