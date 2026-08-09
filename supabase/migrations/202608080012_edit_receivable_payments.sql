create or replace function public.update_receivable_payment(
  p_payment_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_notes text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record public.payments%rowtype;
  receivable_record public.receivables%rowtype;
  account_currency public.currency_code;
  other_payments_total numeric;
  paid_total numeric;
  new_status public.collection_status;
begin
  if not (public.has_permission('collections.manage') or public.has_permission('finance.manage'))
     or not public.has_permission('accounts.manage') then
    raise exception 'insufficient_permission' using errcode = '42501';
  end if;

  select * into payment_record
  from public.payments
  where id = p_payment_id
  for update;
  if not found then raise exception 'payment_not_found'; end if;

  select * into receivable_record
  from public.receivables
  where id = payment_record.receivable_id
  for update;
  if not found then raise exception 'receivable_not_found'; end if;

  select currency into account_currency
  from public.accounts
  where id = p_account_id and status = 'active';
  if account_currency is null or account_currency <> receivable_record.currency then
    raise exception 'currency_mismatch_or_account_missing';
  end if;

  select coalesce(sum(amount), 0) into other_payments_total
  from public.payments
  where receivable_id = payment_record.receivable_id and id <> p_payment_id;

  if p_amount <= 0 or other_payments_total + p_amount > receivable_record.total_amount then
    raise exception 'invalid_payment_amount';
  end if;

  update public.payments
  set account_id = p_account_id,
      amount = p_amount,
      currency = receivable_record.currency,
      payment_date = p_payment_date,
      notes = nullif(trim(p_notes), '')
  where id = p_payment_id;

  update public.finance_transactions
  set account_id = p_account_id,
      transaction_date = p_payment_date,
      amount = p_amount,
      currency = receivable_record.currency,
      description = nullif(trim(p_notes), '')
  where payment_id = p_payment_id;

  paid_total := other_payments_total + p_amount;
  new_status := case
    when paid_total >= receivable_record.total_amount then 'paid'::public.collection_status
    when paid_total > 0 then 'partial'::public.collection_status
    else 'pending'::public.collection_status
  end;

  update public.receivables set status = new_status where id = receivable_record.id;
  update public.service_periods set collection_status = new_status where id = receivable_record.service_period_id;

  insert into public.collection_activities(receivable_id, activity_type, note, created_by)
  values (
    receivable_record.id,
    case when new_status = 'paid' then 'completed'::public.collection_activity_type else 'partial_payment'::public.collection_activity_type end,
    'Ödeme kaydı güncellendi' || case when nullif(trim(p_notes), '') is null then '' else ': ' || trim(p_notes) end,
    auth.uid()
  );
end
$$;

revoke all on function public.update_receivable_payment(uuid, uuid, numeric, date, text) from public;
grant execute on function public.update_receivable_payment(uuid, uuid, numeric, date, text) to authenticated;
