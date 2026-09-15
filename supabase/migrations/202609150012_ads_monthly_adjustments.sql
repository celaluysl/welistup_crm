alter table public.service_periods
  add column if not exists base_net_amount numeric(18,2),
  add column if not exists customer_extra_net_amount numeric(18,2) not null default 0,
  add column if not exists vendor_extra_net_amount numeric(18,2) not null default 0,
  add column if not exists ads_extra_notes text;

update public.service_periods set base_net_amount = net_amount where base_net_amount is null;
alter table public.service_periods alter column base_net_amount set not null;

alter table public.vendor_accruals
  add column if not exists base_net_amount numeric(18,2),
  add column if not exists extra_net_amount numeric(18,2) not null default 0;

update public.vendor_accruals set base_net_amount = net_amount where base_net_amount is null;
alter table public.vendor_accruals alter column base_net_amount set not null;

create or replace function public.set_service_period_base_net_amount()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.base_net_amount is null then new.base_net_amount := new.net_amount; end if;
  return new;
end;
$$;
drop trigger if exists set_service_period_base_net_amount on public.service_periods;
create trigger set_service_period_base_net_amount before insert on public.service_periods
for each row execute function public.set_service_period_base_net_amount();

create or replace function public.set_vendor_accrual_base_net_amount()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.base_net_amount is null then new.base_net_amount := new.net_amount; end if;
  return new;
end;
$$;
drop trigger if exists set_vendor_accrual_base_net_amount on public.vendor_accruals;
create trigger set_vendor_accrual_base_net_amount before insert on public.vendor_accruals
for each row execute function public.set_vendor_accrual_base_net_amount();

create or replace function public.update_ads_monthly_adjustment(
  p_service_period_id uuid,
  p_customer_extra_net numeric,
  p_vendor_extra_net numeric,
  p_notes text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  period public.service_periods%rowtype;
  accrual public.vendor_accruals%rowtype;
  new_net numeric;
  new_vat numeric;
  new_gross numeric;
  paid_total numeric;
  vendor_paid numeric;
  vendor_net numeric;
  vendor_vat numeric;
  vendor_gross numeric;
begin
  if not public.has_permission('finance.manage') then
    raise exception 'insufficient_permission' using errcode = '42501';
  end if;
  if p_customer_extra_net < 0 or p_vendor_extra_net < 0 then raise exception 'invalid_amount'; end if;

  select * into period from public.service_periods where id = p_service_period_id for update;
  if not found then raise exception 'service_period_not_found'; end if;
  if exists (select 1 from public.month_closes where year = period.year and month = period.month and status = 'closed') then
    raise exception 'period_closed';
  end if;
  if exists (select 1 from public.invoices where service_period_id = period.id and status <> 'waiting') then
    raise exception 'invoice_locked';
  end if;

  new_net := period.base_net_amount + p_customer_extra_net;
  new_vat := round(new_net * period.vat_rate / 100, 2);
  new_gross := new_net + new_vat;
  select coalesce(sum(p.amount), 0) into paid_total
  from public.payments p join public.receivables r on r.id = p.receivable_id
  where r.service_period_id = period.id;
  if paid_total > new_gross then raise exception 'payments_exceed_new_total'; end if;

  update public.service_periods
  set customer_extra_net_amount = p_customer_extra_net,
      vendor_extra_net_amount = p_vendor_extra_net,
      ads_extra_notes = nullif(trim(p_notes), ''),
      net_amount = new_net,
      vat_amount = new_vat,
      gross_amount = new_gross
  where id = period.id;

  update public.receivables
  set total_amount = new_gross,
      status = case
        when paid_total >= new_gross and new_gross > 0 then 'paid'::public.collection_status
        when paid_total > 0 then 'partial'::public.collection_status
        when due_date < current_date then 'overdue'::public.collection_status
        else 'pending'::public.collection_status
      end
  where service_period_id = period.id;

  update public.invoices
  set net_amount = new_net, vat_amount = new_vat, total_amount = new_gross
  where service_period_id = period.id and status = 'waiting';

  select * into accrual
  from public.vendor_accruals
  where project_service_id = period.project_service_id
    and year = period.year and month = period.month
    and status <> 'cancelled'
  order by created_at
  limit 1
  for update;

  if p_vendor_extra_net > 0 and accrual.id is null then raise exception 'vendor_accrual_not_found'; end if;
  if accrual.id is not null then
    select coalesce(sum(amount), 0) into vendor_paid from public.vendor_payments where vendor_accrual_id = accrual.id;
    vendor_net := accrual.base_net_amount + p_vendor_extra_net;
    vendor_vat := round(vendor_net * accrual.vat_rate / 100, 2);
    vendor_gross := vendor_net + vendor_vat;
    if vendor_paid > vendor_gross then raise exception 'vendor_payments_exceed_new_total'; end if;
    update public.vendor_accruals
    set extra_net_amount = p_vendor_extra_net,
        net_amount = vendor_net,
        vat_amount = vendor_vat,
        amount = vendor_gross,
        status = case when vendor_paid >= vendor_gross and vendor_gross > 0 then 'paid'::public.accrual_status when vendor_paid > 0 then 'partial'::public.accrual_status else 'pending'::public.accrual_status end
    where id = accrual.id;
  end if;

  update public.service_periods sp
  set cost_amount = coalesce((select sum(a.amount) from public.vendor_accruals a where a.project_service_id = sp.project_service_id and a.year = sp.year and a.month = sp.month and a.status <> 'cancelled'), 0)
  where sp.id = period.id;
end;
$$;

revoke all on function public.update_ads_monthly_adjustment(uuid,numeric,numeric,text) from public;
grant execute on function public.update_ads_monthly_adjustment(uuid,numeric,numeric,text) to authenticated;
