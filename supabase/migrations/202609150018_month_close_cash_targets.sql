create table if not exists public.month_close_settings (
  id boolean primary key default true check (id),
  invoiced_cash_target numeric(18,2) not null default 0 check (invoiced_cash_target >= 0),
  uninvoiced_cash_target numeric(18,2) not null default 0 check (uninvoiced_cash_target >= 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.month_close_settings enable row level security;

create policy month_close_settings_read on public.month_close_settings
for select to authenticated using (public.has_permission('finance.read'));

create policy month_close_settings_manage on public.month_close_settings
for all to authenticated
using (public.has_permission('month_close.manage'))
with check (public.has_permission('month_close.manage'));

insert into public.month_close_settings (id) values (true)
on conflict (id) do nothing;
