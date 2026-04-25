# CLAUDE.md

## Projeto

Nome: `Contato Solar CRM`

Aplicacao web operacional para um CRM imobiliario focado em leads de lancamento. O sistema ja foi concluido e hoje cobre distribuicao de leads, operacao comercial em Kanban, detalhe completo do lead, historico operacional, busca global, metricas e gestao de equipe.

## Objetivo do produto

O app atende dois papeis:

- `admin`
  Distribui leads, acompanha a operacao, administra usuarios, consulta metricas e acessa arquivados.
- `corretor`
  Opera leads atribuidos no proprio Kanban e trabalha principalmente a partir da pagina de detalhe do lead.

## Stack real do repositorio

Runtime:

- `react`
- `react-dom`
- `react-router-dom`
- `@supabase/supabase-js`
- `@tanstack/react-query`
- `react-hook-form`
- `zod`
- `@hookform/resolvers`
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`
- `date-fns`
- `sonner`
- `lucide-react`
- `next-themes`
- `cmdk`
- `shadcn`
- `radix-ui`

Dev:

- `vite`
- `typescript`
- `eslint`
- `typescript-eslint`
- `@vitejs/plugin-react`
- `@tailwindcss/vite`
- `tailwindcss`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

Sempre rode `lint` e `build` antes de concluir alteracoes relevantes.

## Arquitetura

Fluxo principal:

`React frontend -> Supabase Auth/Database -> Edge Function manage-user`

Camadas principais:

- `src/contexts/AuthContext.tsx`
  Carrega sessao, perfil e regras basicas de acesso.
- `src/lib/supabase.ts`
  Cliente do browser.
- `src/lib/manageUser.ts`
  Contrato do frontend com a Edge Function de usuarios.
- `src/lib/leadActivity.ts`
  Registro de atividade operacional.
- `supabase/functions/manage-user/index.ts`
  Camada segura para criacao e exclusao de usuarios.

## Rotas e responsabilidades

- `/login`
  Autenticacao.
- `/`
  Pool de Leads, somente admin.
- `/kanban`
  Operacao do funil.
- `/leads/:id`
  Detalhe do lead.
- `/equipe`
  Gestao de equipe.
- `/metricas`
  Dashboard administrativo.
- `/arquivados`
  Leads arquivados.

## Areas do produto

### Pool de Leads

- lista leads nao atribuidos
- permite atribuicao a corretor
- usa confirmacao antes de atribuir
- registra atividade de atribuicao

### Meu Kanban

Estado final esperado:

- header compacto, sem card de hero
- filtros inline no desktop
- scroll horizontal entre colunas
- colunas com scroll vertical proprio
- cards enxutos com nome, telefone, origem e acao principal
- drag and drop apenas onde for estavel
- fallback por select no mobile

Nao reintroduzir cards densos ou textos decorativos desnecessarios no topo da tela.

### Detalhe do Lead

Fonte principal de contexto operacional do lead.

Deve preservar:

- leitura clara de dados
- acoes importantes em destaque
- notas internas
- conversa
- timeline operacional

### Equipe

Fluxo administrativo sensivel.

Regras:

- criacao e exclusao de usuario sempre via Edge Function
- nao implementar gestao de usuario privilegiado apenas no frontend
- bloquear acoes destrutivas sem confirmacao

### Metricas

Painel administrativo para leitura operacional, nao para visualizacao exuberante. Priorizar clareza, comparacao rapida e cards funcionais.

### Arquivados

Leads arquivados ficam fora da operacao principal. O retorno ao fluxo deve ser claro e seguro.

## Banco e dominio

Tabelas modeladas diretamente no frontend:

- `profiles`
- `leads_lancamento`
- `kanban_stages`
- `lead_notes`
- `lead_activity`
- `lead_tags`
- `tags`
- `chat_history`

Tabelas citadas no dominio, mas sem modelagem direta confiavel no frontend atual:

- `historico_mensagens`
- `imoveis`
- `documents`
- `custo_tokens`
- `n8n_chat_histories_sdr`

Nao invente schema de tabela sem confirmar no codigo ou no banco.

## Edge Function `manage-user`

Responsabilidades:

- validar JWT do chamador
- confirmar que o chamador e admin ativo
- criar usuario no Auth
- sincronizar `profiles`
- excluir usuario com seguranca
- impedir autoexclusao
- impedir exclusao de corretor com leads ativos

Secrets obrigatorios:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Nunca mover essa logica privilegiada para o frontend.

## Regras tecnicas

- manter TypeScript estrito
- nao introduzir `any` sem necessidade real
- formularios novos devem usar `react-hook-form` + `zod`
- queries e mutations de tela devem preferir TanStack Query
- invalidar queries relacionadas apos mutation
- componentes de UI devem vir de `src/components/ui`
- icones via `lucide-react`
- feedback via `sonner`
- helpers compartilhados em `src/lib`
- tipos compartilhados em `src/types/index.ts`

## Regras de UX

- foco em usabilidade operacional
- evitar telas com excesso de texto introdutorio
- estados vazios e erros devem ser objetivos
- acoes destrutivas exigem confirmacao
- mobile precisa continuar funcional
- Kanban deve priorizar leitura, densidade controlada e velocidade de operacao

## Regras visuais

- manter linguagem SaaS profissional e contida
- evitar visual generico de dashboard de desenvolvedor
- usar espaco, hierarquia e contraste com moderacao
- nao adicionar decoracao gratuita
- preservar consistencia entre Pool, Kanban, Equipe, Metricas e Lead Detail

## Seguranca

- nunca expor `SUPABASE_SERVICE_ROLE_KEY`
- nunca confiar apenas em gate de frontend para permissao critica
- manter RLS ativa
- nao armazenar senha em tabela da aplicacao
- respeitar relacao entre `profiles.id` e `auth.users.id`

## Entrega e Git

- rodar `npm run lint`
- rodar `npm run build`
- usar mensagem de commit curta em ingles
- nao commitar arquivos locais do ambiente do agente
- so fazer push quando o usuario pedir

## O que evitar

- reintroduzir modal grande no lugar da pagina de detalhe
- aumentar densidade dos cards do Kanban sem necessidade
- mover logica admin sensivel para o client
- documentar dependencias ou tabelas que nao existem no repo atual
- quebrar o fluxo entre pool, kanban, detalhe e arquivados
