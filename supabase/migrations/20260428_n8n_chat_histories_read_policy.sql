alter table if exists public.n8n_chat_histories_nova enable row level security;

drop policy if exists n8n_chat_histories_nova_select_authenticated on public.n8n_chat_histories_nova;
