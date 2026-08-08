create type public.lead_status as enum('new','contacted','meeting','preparing_offer','offer_sent','negotiation','won','lost');
create type public.lead_activity_type as enum('call','whatsapp','email','meeting','note','status_change');
create table public.leads(
 id uuid primary key default gen_random_uuid(),company_name text not null,contact_name text,phone text,email text,source text,
 estimated_budget numeric(18,2) check(estimated_budget is null or estimated_budget>=0),currency public.currency_code not null default'TRY',
 sales_owner_id uuid references public.profiles(id),next_contact_date date,description text,status public.lead_status not null default'new',lost_reason text,
 converted_client_id uuid references public.clients(id),created_by uuid not null references public.profiles(id),updated_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.lead_services(lead_id uuid not null references public.leads(id)on delete cascade,service_id uuid not null references public.services(id),primary key(lead_id,service_id));
create table public.lead_activities(id uuid primary key default gen_random_uuid(),lead_id uuid not null references public.leads(id)on delete cascade,activity_type public.lead_activity_type not null,note text,activity_at timestamptz not null default now(),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create index leads_status_idx on public.leads(status);create index leads_owner_idx on public.leads(sales_owner_id);create index leads_next_contact_idx on public.leads(next_contact_date);create index lead_activities_lead_idx on public.lead_activities(lead_id,activity_at desc);
create trigger set_updated_at before update on public.leads for each row execute function public.set_updated_at();
insert into public.permissions(key,name,module)values('sales.read','Lead ve satışları görüntüle','sales'),('sales.manage','Lead ve satışları yönet','sales');
insert into public.role_permissions(role_id,permission_id)select r.id,p.id from public.roles r cross join public.permissions p where r.slug='super-admin'and p.module='sales';
insert into public.role_permissions(role_id,permission_id)select r.id,p.id from public.roles r join public.permissions p on p.key in('sales.read','sales.manage')where r.slug in('partner','sales');
alter table public.leads enable row level security;alter table public.lead_services enable row level security;alter table public.lead_activities enable row level security;
create policy leads_read on public.leads for select to authenticated using(public.has_permission('sales.read'));
create policy leads_manage on public.leads for all to authenticated using(public.has_permission('sales.manage'))with check(public.has_permission('sales.manage'));
create policy lead_services_access on public.lead_services for all to authenticated using(public.has_permission('sales.read'))with check(public.has_permission('sales.manage'));
create policy lead_activities_access on public.lead_activities for all to authenticated using(public.has_permission('sales.read'))with check(public.has_permission('sales.manage')and created_by=auth.uid());
create or replace function public.log_lead_change()returns trigger language plpgsql security definer set search_path=''as $$begin insert into public.activity_logs(actor_id,entity_type,entity_id,action,old_values,new_values)values(auth.uid(),'lead',new.id,case when tg_op='INSERT'then'created'else'updated'end,case when tg_op='UPDATE'then to_jsonb(old)else null end,to_jsonb(new));return new;end$$;
create trigger lead_activity_log after insert or update on public.leads for each row execute function public.log_lead_change();
