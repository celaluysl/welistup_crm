-- Welistup Agency OS / Phase 1 foundation
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.employment_type as enum ('partner','employee','freelancer','outsourced','other');
create type public.record_status as enum ('active','inactive','archived');
create type public.client_type as enum ('direct','agency','partner','other');
create type public.project_status as enum ('active','on_hold','completed','archived');
create type public.service_periodicity as enum ('monthly','one_time','periodic');
create type public.currency_code as enum ('TRY','USD','EUR','GBP');
create type public.billing_preference as enum ('invoiced','uninvoiced');

create table public.roles (
  id uuid primary key default gen_random_uuid(), name text not null unique, slug text not null unique,
  description text, is_system boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.permissions (
  id uuid primary key default gen_random_uuid(), key text not null unique, name text not null, module text not null,
  description text, created_at timestamptz not null default now()
);
create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '', last_name text not null default '', email text not null,
  phone text, avatar_path text, role_id uuid references public.roles(id), employment_type public.employment_type not null default 'employee',
  status public.record_status not null default 'active', hire_date date, termination_date date, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(), company_name text not null, short_name text,
  client_type public.client_type not null default 'direct', contact_name text, phone text, email text, address text,
  tax_office text, tax_number text, national_id text, default_vat_rate numeric(5,2) not null default 20 check (default_vat_rate between 0 and 100),
  default_currency public.currency_code not null default 'TRY', billing_preference public.billing_preference not null default 'invoiced',
  source text, status public.record_status not null default 'active', notes text,
  created_by uuid references public.profiles(id), updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.client_contacts (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id), name text not null,
  title text, email text, phone text, is_primary boolean not null default false, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id), name text not null,
  domain text, description text, owner_id uuid references public.profiles(id), start_date date, end_date date,
  status public.project_status not null default 'active', is_white_label boolean not null default false, notes text,
  created_by uuid references public.profiles(id), updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create unique index projects_active_domain_unique on public.projects(lower(domain)) where domain is not null and status <> 'archived';
create table public.project_members (
  project_id uuid not null references public.projects(id), profile_id uuid not null references public.profiles(id),
  access_level text not null default 'member' check (access_level in ('viewer','member','manager')),
  created_at timestamptz not null default now(), primary key(project_id, profile_id)
);
create table public.services (
  id uuid primary key default gen_random_uuid(), name text not null unique, description text, category text,
  default_periodicity public.service_periodicity not null default 'monthly', status public.record_status not null default 'active',
  created_by uuid references public.profiles(id), updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.project_services (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id), service_id uuid not null references public.services(id),
  periodicity public.service_periodicity not null, currency public.currency_code not null default 'TRY', billing_preference public.billing_preference not null default 'invoiced',
  start_date date not null, end_date date, payment_term_days integer not null default 0 check (payment_term_days >= 0), status public.record_status not null default 'active', notes text,
  created_by uuid references public.profiles(id), updated_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create table public.project_service_members (
  project_service_id uuid not null references public.project_services(id), profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), primary key(project_service_id, profile_id)
);
create table public.project_service_prices (
  id uuid primary key default gen_random_uuid(), project_service_id uuid not null references public.project_services(id),
  net_price numeric(18,2) not null check(net_price >= 0), vat_rate numeric(5,2) not null check(vat_rate between 0 and 100),
  currency public.currency_code not null, effective_from date not null, effective_to date,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  exclude using gist (project_service_id with =, daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&)
);

create index clients_status_idx on public.clients(status);
create index clients_type_idx on public.clients(client_type);
create index projects_client_idx on public.projects(client_id);
create index projects_owner_idx on public.projects(owner_id);
create index project_members_profile_idx on public.project_members(profile_id);
create index project_services_project_idx on public.project_services(project_id);
create index project_services_service_idx on public.project_services(service_id);
create index project_service_members_profile_idx on public.project_service_members(profile_id);
create index project_service_prices_lookup_idx on public.project_service_prices(project_service_id, effective_from desc);

create or replace function public.set_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['roles','profiles','clients','client_contacts','projects','services','project_services'] loop execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t); end loop; end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id,email,first_name,last_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'first_name',''),coalesce(new.raw_user_meta_data->>'last_name','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.has_permission(requested text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p join public.role_permissions rp on rp.role_id=p.role_id join public.permissions x on x.id=rp.permission_id where p.id=(select auth.uid()) and p.status='active' and x.key=requested)
$$;
create or replace function public.can_access_project(requested_project uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_permission('projects.read_all') or exists(select 1 from public.projects p where p.id=requested_project and p.owner_id=(select auth.uid())) or exists(select 1 from public.project_members m where m.project_id=requested_project and m.profile_id=(select auth.uid()))
$$;
revoke all on function public.has_permission(text) from public; grant execute on function public.has_permission(text) to authenticated;
revoke all on function public.can_access_project(uuid) from public; grant execute on function public.can_access_project(uuid) to authenticated;

alter table public.roles enable row level security; alter table public.permissions enable row level security; alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security; alter table public.clients enable row level security; alter table public.client_contacts enable row level security;
alter table public.projects enable row level security; alter table public.project_members enable row level security; alter table public.services enable row level security;
alter table public.project_services enable row level security; alter table public.project_service_members enable row level security; alter table public.project_service_prices enable row level security;

create policy roles_read on public.roles for select to authenticated using (true);
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);
create policy roles_manage on public.roles for all to authenticated using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
create policy role_permissions_manage on public.role_permissions for all to authenticated using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
create policy profiles_read_self_or_team on public.profiles for select to authenticated using (id=(select auth.uid()) or public.has_permission('team.read'));
create policy profiles_manage on public.profiles for update to authenticated using (public.has_permission('team.manage')) with check (public.has_permission('team.manage'));
create policy clients_read on public.clients for select to authenticated using (public.has_permission('clients.read'));
create policy clients_insert on public.clients for insert to authenticated with check (public.has_permission('clients.manage'));
create policy clients_update on public.clients for update to authenticated using (public.has_permission('clients.manage')) with check (public.has_permission('clients.manage'));
create policy client_contacts_access on public.client_contacts for all to authenticated using (public.has_permission('clients.read')) with check (public.has_permission('clients.manage'));
create policy projects_read on public.projects for select to authenticated using (public.can_access_project(id));
create policy projects_manage on public.projects for all to authenticated using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));
create policy project_members_read on public.project_members for select to authenticated using (public.can_access_project(project_id));
create policy project_members_manage on public.project_members for all to authenticated using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));
create policy services_read on public.services for select to authenticated using (true);
create policy services_manage on public.services for all to authenticated using (public.has_permission('services.manage')) with check (public.has_permission('services.manage'));
create policy project_services_read on public.project_services for select to authenticated using (public.can_access_project(project_id));
create policy project_services_manage on public.project_services for all to authenticated using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));
create policy service_members_read on public.project_service_members for select to authenticated using (exists(select 1 from public.project_services ps where ps.id=project_service_id and public.can_access_project(ps.project_id)));
create policy service_members_manage on public.project_service_members for all to authenticated using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));
create policy prices_finance_read on public.project_service_prices for select to authenticated using (public.has_permission('finance.read'));
create policy prices_manage on public.project_service_prices for all to authenticated using (public.has_permission('finance.manage')) with check (public.has_permission('finance.manage'));

insert into public.permissions(key,name,module) values
('clients.read','Müşterileri görüntüle','clients'),('clients.manage','Müşterileri yönet','clients'),('projects.read_all','Tüm projeleri görüntüle','projects'),('projects.manage','Projeleri yönet','projects'),
('services.manage','Hizmetleri yönet','services'),('team.read','Ekibi görüntüle','team'),('team.manage','Ekibi yönet','team'),('finance.read','Finansal verileri görüntüle','finance'),('finance.manage','Finansal verileri yönet','finance'),('settings.manage','Ayarları yönet','settings');
insert into public.roles(name,slug,description,is_system) values
('Super Admin','super-admin','Tüm sistem erişimi',true),('Ortak','partner','Yönetim ve finans erişimi',true),('Çalışan','employee','Atanmış operasyon kayıtları',true),('Freelancer','freelancer','Sınırlı atanmış iş erişimi',true),('Satış','sales','Satış ve müşteri erişimi',true),('Tahsilat','collections','Tahsilat odaklı erişim',true),('Muhasebe','accounting','Finans operasyon erişimi',true);
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.slug='super-admin';
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r join public.permissions p on p.key in ('clients.read','clients.manage','projects.read_all','projects.manage','services.manage','team.read','finance.read','finance.manage') where r.slug='partner';
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r join public.permissions p on p.key in ('clients.read') where r.slug in ('employee','sales','collections','accounting');

insert into public.services(name,category,default_periodicity) values
('SEO','Dijital Pazarlama','monthly'),('Google Ads','Dijital Reklam','monthly'),('Meta Ads','Dijital Reklam','monthly'),('Sosyal Medya Yönetimi','Sosyal Medya','monthly'),('Trendyol Reklam Yönetimi','Pazaryeri','monthly'),('Web Tasarım','Web','one_time'),('Web Yazılım','Web','one_time'),('Sunucu','Altyapı','monthly'),('Hosting','Altyapı','periodic'),('Domain','Altyapı','periodic'),('İçerik','İçerik','periodic'),('Grafik Tasarım','Tasarım','periodic'),('Danışmanlık','Danışmanlık','periodic'),('Diğer','Diğer','periodic');

-- Promote the first user manually after signup:
-- update public.profiles set role_id=(select id from public.roles where slug='super-admin') where email='admin@example.com';
