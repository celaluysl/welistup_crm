alter table public.clients add column legal_name text;
update public.clients set legal_name=company_name where legal_name is null;
alter table public.projects add column billing_preference public.billing_preference;
update public.projects p set billing_preference=c.billing_preference from public.clients c where c.id=p.client_id and p.billing_preference is null;
alter table public.projects alter column billing_preference set default'invoiced';
alter table public.projects alter column billing_preference set not null;
