alter table public.vendor_payments
  alter column account_id drop not null,
  add column if not exists payment_channel text not null default 'cash_account'
    check (payment_channel in ('cash_account','client_direct')),
  add column if not exists payer_name text;

alter table public.vendor_payments
  add constraint vendor_payments_channel_details_check check (
    (payment_channel='cash_account' and account_id is not null)
    or (payment_channel='client_direct' and account_id is null and transaction_id is null and nullif(trim(payer_name),'') is not null)
  ) not valid;

alter table public.vendor_payments validate constraint vendor_payments_channel_details_check;

create or replace function public.settle_vendor_accrual_direct(p_accrual_id uuid,p_amount numeric,p_payment_date date,p_payer_name text,p_notes text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare accrual public.vendor_accruals%rowtype; paid numeric; payment_id uuid; new_status public.accrual_status;
begin
  if not public.has_permission('vendors.manage') then raise exception'insufficient_permission' using errcode='42501'; end if;
  select * into accrual from public.vendor_accruals where id=p_accrual_id for update;
  if not found then raise exception'accrual_not_found'; end if;
  if accrual.requires_amount_review then raise exception'amount_review_required'; end if;
  if nullif(trim(p_payer_name),'') is null then raise exception'payer_required'; end if;
  select coalesce(sum(amount),0) into paid from public.vendor_payments where vendor_accrual_id=p_accrual_id;
  if p_amount<=0 or paid+p_amount>accrual.amount then raise exception'invalid_payment_amount'; end if;
  insert into public.vendor_payments(vendor_accrual_id,account_id,amount,currency,payment_date,transaction_id,notes,created_by,payment_channel,payer_name)
  values(p_accrual_id,null,p_amount,accrual.currency,p_payment_date,null,p_notes,auth.uid(),'client_direct',trim(p_payer_name)) returning id into payment_id;
  paid:=paid+p_amount;
  new_status:=case when paid>=accrual.amount then'paid'::public.accrual_status else'partial'::public.accrual_status end;
  update public.vendor_accruals set status=new_status where id=p_accrual_id;
  return payment_id;
end$$;

grant execute on function public.settle_vendor_accrual_direct(uuid,numeric,date,text,text) to authenticated;

update public.vendor_assignments va set billing_preference='invoiced',vat_rate=case when vat_rate=0 then 20 else vat_rate end
from public.vendors v where v.id=va.vendor_id and (lower(v.name) like 'tuğrul%' or lower(v.name) like 'tugrul%');

update public.vendor_accruals a set billing_preference='invoiced',vat_rate=case when a.vat_rate=0 then 20 else a.vat_rate end,
  vat_amount=round(a.net_amount*(case when a.vat_rate=0 then 20 else a.vat_rate end)/100,2),
  amount=a.net_amount+round(a.net_amount*(case when a.vat_rate=0 then 20 else a.vat_rate end)/100,2)
from public.vendors v where v.id=a.vendor_id and a.status in('pending','partial') and (lower(v.name) like 'tuğrul%' or lower(v.name) like 'tugrul%');
