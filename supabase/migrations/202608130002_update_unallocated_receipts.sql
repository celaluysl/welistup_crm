create or replace function public.update_unallocated_customer_receipt(
  p_receipt_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_received_date date,
  p_notes text
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  receipt public.unallocated_customer_receipts%rowtype;
  account_currency public.currency_code;
begin
  if not (public.has_permission('collections.manage') or public.has_permission('finance.manage'))
     or not public.has_permission('accounts.manage') then
    raise exception'insufficient_permission' using errcode='42501';
  end if;
  if p_amount<=0 then raise exception'invalid_payment_amount'; end if;

  select * into receipt from public.unallocated_customer_receipts where id=p_receipt_id for update;
  if not found then raise exception'receipt_not_found'; end if;
  if receipt.status not in('unidentified','available') or receipt.remaining_amount<>receipt.amount then
    raise exception'receipt_already_classified';
  end if;
  if exists(select 1 from public.month_closes where status='closed' and (year=extract(year from receipt.received_date) and month=extract(month from receipt.received_date) or year=extract(year from p_received_date) and month=extract(month from p_received_date))) then
    raise exception'period_closed';
  end if;
  select currency into account_currency from public.accounts where id=p_account_id and status='active';
  if account_currency is null or account_currency<>receipt.currency then raise exception'currency_mismatch'; end if;

  update public.unallocated_customer_receipts
  set account_id=p_account_id,amount=p_amount,remaining_amount=p_amount,received_date=p_received_date,notes=p_notes
  where id=p_receipt_id;
  update public.finance_transactions
  set account_id=p_account_id,amount=p_amount,transaction_date=p_received_date,
      description=coalesce(nullif(trim(p_notes),''),'Fazla tahsilat; hizmet eşleştirmesi bekleniyor')
  where id=receipt.transaction_id;
end$$;

revoke all on function public.update_unallocated_customer_receipt(uuid,uuid,numeric,date,text) from public;
grant execute on function public.update_unallocated_customer_receipt(uuid,uuid,numeric,date,text) to authenticated;
