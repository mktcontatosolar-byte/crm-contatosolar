# CLAUDE.md

## Projeto
- Nome: `crm-lancamento`
- Tipo: CRM operacional para distribuição, acompanhamento, qualificação e gestão de leads imobiliários
- Frontend SPA em React com Supabase como backend

## Stack obrigatória
- `React 19`
- `TypeScript`
- `Vite`
- `Tailwind CSS v4`
- `shadcn/ui` + `radix-ui`
- `lucide-react` para todos os ícones
- `@tanstack/react-query` para fetch, cache, mutations e invalidação
- `react-hook-form` + `zod` para formulários
- `sonner` para todos os toasts
- `date-fns` com locale `pt-BR` para datas e tempos relativos
- `@supabase/supabase-js` para Auth, queries, realtime e Edge Functions
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` para drag and drop do Kanban

## Regras de frontend
- Não usar componentes HTML crus sem estilo quando houver equivalente em `shadcn/ui`.
- Não usar ícones fora de `lucide-react`.
- Todo loading importante deve ter feedback visual claro.
- Todo estado vazio deve ter mensagem útil.
- Toda ação sensível deve ter confirmação quando houver risco operacional.
- Toda interface deve funcionar em mobile e desktop.
- Em mobile, alvos de toque devem priorizar `min-h-12`.
- Preferir layouts operacionais, densos e legíveis. Evitar visual genérico de dashboard boilerplate.
- A identidade visual do projeto segue laranja + azul escuro.

## Padrões de código
- Manter TypeScript estrito e sem quebrar tipos existentes.
- Reaproveitar tipos de `src/types/index.ts`.
- Usar `useQuery` para leitura e `useMutation` para escrita.
- Invalidar queries relacionadas após mutations bem-sucedidas.
- Não duplicar lógica de acesso ao Supabase em vários lugares sem necessidade.
- Preferir funções auxiliares reutilizáveis em `src/lib`.
- Não introduzir bibliotecas novas sem necessidade clara.
- Não reverter mudanças do usuário sem pedido explícito.

## Regras de segurança
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Operações privilegiadas de usuário devem passar por Edge Functions.
- O frontend só pode usar `anon key` e JWT da sessão atual.
- Toda validação de permissão deve ocorrer no backend ou na Edge Function, nunca confiar apenas no frontend.
- Considerar RLS ativa em todas as tabelas.
- Excluir usuário do Auth apenas por fluxo seguro via Edge Function.
- Autoexclusão de admin deve continuar bloqueada.
- Exclusão de corretor com leads ativos deve continuar bloqueada.

## Supabase
- Cliente frontend padrão em `src/lib/supabase.ts`
- Edge Function de gestão de usuários em `supabase/functions/manage-user/index.ts`
- A Edge Function `manage-user` deve:
  - validar `Authorization` header
  - validar se o solicitante é admin ativo
  - usar `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor
  - executar `createUser` e `deleteUser`

## Estrutura principal de tabelas

### `profiles`
- `id`
- `email`
- `nome`
- `role`
- `ativo`
- `created_at`
- `updated_at`

### `leads_lancamento`
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

### `kanban_stages`
- `id`
- `nome`
- `ordem`
- `cor`
- `is_final`

### `lead_tags`
- `lead_id`
- `tag_id`

### `tags`
- `id`
- `nome`
- `cor`
- `created_by`

### `lead_notes`
- `id`
- `lead_id`
- `author_id`
- `content`
- `created_at`

### `chat_history`
- `id`
- `lead_id`
- `role`
- `content`
- `created_at`

### `lead_activity`
- `id`
- `lead_id`
- `usuario_id`
- `tipo`
- `descricao`
- `metadata`
- `created_at`

## Outras tabelas existentes no ambiente
- `custo_tokens`
- `documents`
- `historico_mensagens`
- `imoveis`
- `leads`
- `n8n_chat_histories_sdr`

## Regras funcionais importantes
- Mover lead no Kanban altera `stage_id`, mas não arquiva automaticamente.
- Arquivamento ocorre apenas por ação explícita na página de detalhe do lead.
- Desarquivar deve devolver o lead ao pool com `corretor_id = null`.
- Devolver lead ao pool deve limpar `corretor_id`, `assumed_at` e `stage_id`.
- Atribuição de corretor deve registrar atividade em `lead_activity`.
- Mudança de etapa, devolução ao pool, arquivamento, desarquivamento e IA devem registrar atividade em `lead_activity`.
- A busca global deve abrir por botão e `Ctrl+K`, usando `CommandDialog`.

## Páginas e fluxos principais
- `/` -> Pool de Leads
- `/kanban` -> Meu Kanban
- `/equipe` -> Equipe
- `/metricas` -> Métricas
- `/arquivados` -> Leads Arquivados
- `/leads/:id` -> Detalhe do lead

## Regras de formulários e feedback
- Formulários novos devem usar `react-hook-form` + `zod`.
- Sucesso e erro devem usar `sonner`.
- Erros operacionais devem mostrar mensagem específica quando houver código conhecido.
- Loading de tela e cards deve usar skeleton ou estado visual equivalente.

## Regras de commit
- Commits devem ser pequenos, objetivos e descritivos.
- Preferir mensagens em inglês curtas no imperativo.
- Não misturar refactor amplo com hotfix visual sem necessidade.
- Sempre rodar `npm run lint` e `npm run build` antes de commitar quando houver alteração de código.

## Regras de deploy e validação
- Validar sempre:
  - `npm run lint`
  - `npm run build`
- Se houver mudança em Edge Function, validar também o contrato do frontend com o payload esperado.
- Em problemas de Auth/Admin, conferir logs da Edge Function no dashboard do Supabase antes de presumir erro no frontend.
