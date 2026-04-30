drop policy if exists profiles_update_notifications_admin_owner
on public.profiles;

create policy profiles_update_notifications_admin_owner
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles requester
    where requester.id = auth.uid()
      and requester.ativo = true
      and requester.role in ('dono', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles requester
    where requester.id = auth.uid()
      and requester.ativo = true
      and requester.role in ('dono', 'admin')
  )
);
