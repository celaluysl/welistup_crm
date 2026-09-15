create table if not exists public.app_features (
  feature_key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.app_features enable row level security;

drop policy if exists app_features_read on public.app_features;
create policy app_features_read on public.app_features
for select to authenticated using (true);

drop policy if exists app_features_manage on public.app_features;
create policy app_features_manage on public.app_features
for all to authenticated
using (public.has_permission('settings.manage'))
with check (public.has_permission('settings.manage'));

drop trigger if exists set_updated_at on public.app_features;
create trigger set_updated_at before update on public.app_features
for each row execute function public.set_updated_at();

insert into public.app_features (feature_key, enabled)
values ('financial_reports_menu', false)
on conflict (feature_key) do nothing;
