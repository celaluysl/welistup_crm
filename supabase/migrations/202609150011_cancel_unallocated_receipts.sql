create or replace function public.cancel_unallocated_customer_receipt(
  p_receipt_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt public.unallocated_customer_receipts%rowtype;
begin
  if not (public.has_permission('collections.manage') or public.has_permission('finance.manage'))
     or not public.has_permission('accounts.manage') then
    raise exception 'insufficient_permission' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then raise exception 'reason_required'; end if;

  select * into receipt
  from public.unallocated_customer_receipts
  where id = p_receipt_id
  for update;
  if not found then raise exception 'receipt_not_found'; end if;
  if receipt.status not in ('unidentified', 'available')
     or receipt.remaining_amount <> receipt.amount then
    raise exception 'receipt_already_classified';
  end if;
  if exists (
    select 1 from public.month_closes
    where year = extract(year from receipt.received_date)::integer
      and month = extract(month from receipt.received_date)::integer
      and status = 'closed'
  ) then raise exception 'period_closed'; end if;

  update public.unallocated_customer_receipts
  set status = 'refunded',
      remaining_amount = 0,
      transaction_id = null,
      notes = concat_ws(E'\n', nullif(trim(notes), ''), 'İptal: ' || trim(p_reason))
  where id = receipt.id;

  delete from public.finance_transactions where id = receipt.transaction_id;

  if receipt.source_receivable_id is not null then
    insert into public.collection_activities(receivable_id, activity_type, note, created_by)
    values (receipt.source_receivable_id, 'note', 'Fazla tahsilat iptal edildi: ' || trim(p_reason), auth.uid());
  end if;
end;
$$;

revoke all on function public.cancel_unallocated_customer_receipt(uuid, text) from public;
grant execute on function public.cancel_unallocated_customer_receipt(uuid, text) to authenticated;

-- Explicitly requested correction: the extra Merven receipt entered on
-- 2026-08-07 with the matching review note. Preserve the receipt as an audit
-- record while reversing its cash transaction.
do $$
declare
  target_receipt public.unallocated_customer_receipts%rowtype;
begin
  select r.* into target_receipt
  from public.unallocated_customer_receipts r
  join public.clients c on c.id = r.client_id
  where lower(c.company_name) = lower('Merven Akyüz')
    and r.received_date = date '2026-08-07'
    and r.amount = 25000
    and r.status in ('unidentified', 'available')
    and r.remaining_amount = r.amount
    and r.notes ilike '%ekstra ödeme gelmiş%'
  order by r.created_at desc
  limit 1;

  if found then
    update public.unallocated_customer_receipts
    set status = 'refunded',
        remaining_amount = 0,
        transaction_id = null,
        notes = concat_ws(E'\n', nullif(trim(notes), ''), 'İptal: Yanlış girilen fazla tahsilat kaldırıldı.')
    where id = target_receipt.id;
    delete from public.finance_transactions where id = target_receipt.transaction_id;
  end if;
end $$;
