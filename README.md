# CRM Lançamento

## 1. Descrição
- Nome: `CRM Lançamento`
- O que é: CRM imobiliário para gestão de leads, corretores e funil de vendas

## 2. Stack
- React + TypeScript strict
- Vite
- Supabase (Auth, Database, Edge Functions, RLS)
- TanStack Query
- TanStack Table
- React Hook Form + Zod
- shadcn/ui + Tailwind CSS
- lucide-react
- sonner
- date-fns com `pt-BR`
- `@dnd-kit` (drag and drop)
- Netlify (deploy)

## 3. Estrutura de pastas
```text
crm-lancamento/
├─ public/                    # Arquivos públicos estáticos
├─ src/
│  ├─ assets/                 # Recursos visuais e estáticos do app
│  ├─ components/             # Componentes reutilizáveis e UI base
│  ├─ contexts/               # Contextos globais, incluindo autenticação
│  ├─ hooks/                  # Hooks reutilizáveis
│  ├─ lib/                    # Helpers, integração com Supabase e utilitários
│  ├─ pages/                  # Páginas principais do CRM
│  └─ types/                  # Tipos TypeScript do domínio
├─ supabase/
│  └─ functions/
│     ├─ _shared/             # Helpers compartilhados das Edge Functions
│     └─ manage-user/         # Edge Function de gestão de usuários
├─ CLAUDE.md                  # Instruções permanentes do projeto
├─ components.json            # Configuração do shadcn/ui
├─ eslint.config.js           # Configuração de lint
├─ index.html                 # HTML base do Vite
├─ package.json               # Scripts e dependências
├─ tsconfig*.json             # Configuração TypeScript
└─ vite.config.ts             # Configuração do Vite
```

## 4. Tabelas do Supabase
- `leads_lancamento` — leads do funil de lançamento
- `profiles` — perfis de usuários (`admin` e `corretor`)
- `kanban_stages` — etapas do kanban
- `lead_notes` — notas internas dos leads
- `lead_activity` — histórico de atividades dos leads
- `lead_tags` — tags dos leads
- `tags` — tabela de tags
- `chat_history` — histórico de conversa
- `historico_mensagens` — mensagens
- `imoveis` — imóveis cadastrados
- `documents` — documentos
- `custo_tokens` — controle de custo de tokens de IA
- `n8n_chat_histories_sdr` — histórico do SDR do n8n

## 5. Edge Functions
- `manage-user` — criação e exclusão segura de usuários via Supabase Auth admin

## 6. Variáveis de ambiente necessárias
Crie um arquivo `.env` na raiz com:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 7. Como rodar localmente
```bash
npm install
```

Configurar `.env` com as variáveis acima.

```bash
npm run dev
```

Comandos úteis:

```bash
npm run lint
npm run build
```

## 8. Deploy
- Conectado à Netlify via GitHub na branch `main`
- Build command: `npm run build`
- Publish directory: `dist`
- Redeploy automático a cada push na `main`

## 9. Regras de segurança
- `SERVICE_ROLE_KEY` nunca exposta no frontend
- RLS ativo em todas as tabelas
- Operações admin sempre via Edge Function
