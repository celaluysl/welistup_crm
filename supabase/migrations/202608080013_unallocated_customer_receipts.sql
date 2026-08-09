create table public.unallocated_customer_receipts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  source_receivable_id uuid references public.receivables(id),
  account_id uuid not null references public.accounts(id),
  transaction_id uuid unique references public.finance_transactions(id),
  amount numeric(18,2) not null check (amount > 0),
  remaining_amount numeric(18,2) not null check (remaining_amount >= 0 and remaining_amount <= amount),
  currency public.currency_code not null,
  received_date date not null,
  status text not null default 'unidentified' check (status in ('unidentified','available','allocated','refunded')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index unallocated_customer_receipts_client_idx
  on public.unallocated_customer_receipts(client_id, status, received_date desc);
create trigger set_updated_at before update on public.unallocated_customer_receipts
  for each row execute function public.set_updated_at();
alter table public.unallocated_customer_receipts enable row level security;
create policy unallocated_receipts_read on public.unallocated_customer_receipts
  for select to authenticated
  using (public.has_permission('finance.read') or public.has_permission('collections.read'));
create policy unallocated_receipts_manage on public.unallocated_customer_receipts
  for all to authenticated
  using (public.has_permission('finance.manage') or public.has_permission('collections.manage'))
  with check ((public.has_permission('finance.manage') or public.has_permission('collections.manage')) and created_by = auth.uid());

create or replace function public.record_receivable_payment_with_excess(
  p_receivable_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_notes text,
  p_allow_excess boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.receivables%rowtype;
  account_currency public.currency_code;
  already_paid numeric;
  remaining_due numeric;
  allocated_amount numeric;
  excess_amount numeric;
  payment_id uuid;
  excess_transaction_id uuid;
  excess_receipt_id uuid;
  new_status public.collection_status;
begin
  if not (public.has_permission('collections.manage') or public.has_permission('finance.manage'))
     or not public.has_permission('accounts.manage') then
    raise exception 'insufficient_permission' using errcode = '42501';
  end if;
  if p_amount <= 0 then raise exception 'invalid_payment_amount'; end if;

  select * into rec from public.receivables where id = p_receivable_id for update;
  if not found then raise exception 'receivable_not_found'; end if;
  select currency into account_currency from public.accounts where id = p_account_id and status = 'active';
  if account_currency is null or account_currency <> rec.currency then
    raise exception 'currency_mismatch_or_account_missing';
  end if;

  select coalesce(sum(amount), 0) into already_paid
  from public.payments where receivable_id = p_receivable_id;
  remaining_due := greatest(0, rec.total_amount - already_paid);
  allocated_amount := least(p_amount, remaining_due);
  excess_amount := p_amount - allocated_amount;

  if excess_amount > 0 and not p_allow_excess then
    raise exception 'excess_payment_confirmation_required';
  end if;

  if allocated_amount > 0 then
    insert into public.payments(receivable_id, amount, currency, payment_date, account_id, notes, created_by)
    values (p_receivable_id, allocated_amount, rec.currency, p_payment_date, p_account_id, p_notes, auth.uid())
    returning id into payment_id;
    insert into public.finance_transactions(account_id, transaction_date, transaction_type, amount, currency, client_id, project_id, category, description, payment_id, created_by)
    values (p_account_id, p_payment_date, 'income', allocated_amount, rec.currency, rec.client_id, rec.project_id, 'Müşteri tahsilatı', p_notes, payment_id, auth.uid());
  end if;

  if excess_amount > 0 then
    insert into public.finance_transactions(account_id, transaction_date, transaction_type, amount, currency, client_id, category, description, created_by)
    values (p_account_id, p_payment_date, 'income', excess_amount, rec.currency, rec.client_id, 'Açıklanamayan müşteri tahsilatı', coalesce(nullif(trim(p_notes), ''), 'Fazla tahsilat; hizmet eşleştirmesi bekleniyor'), auth.uid())
    returning id into excess_transaction_id;
    insert into public.unallocated_customer_receipts(client_id, source_receivable_id, account_id, transaction_id, amount, remaining_amount, currency, received_date, notes, created_by)
    values (rec.client_id, rec.id, p_account_id, excess_transaction_id, excess_amount, excess_amount, rec.currency, p_payment_date, p_notes, auth.uid())
    returning id into excess_receipt_id;
  end if;

  already_paid := already_paid + allocated_amount;
  new_status := case when already_paid >= rec.total_amount then 'paid'::public.collection_status else 'partial'::public.collection_status end;
  update public.receivables set status = new_status where id = rec.id;
  update public.service_periods set collection_status = new_status where id = rec.service_period_id;
  insert into public.collection_activities(receivable_id, activity_type, note, created_by)
  values (rec.id, case when new_status = 'paid' then 'completed'::public.collection_activity_type else 'partial_payment'::public.collection_activity_type end,
    case when excess_amount > 0 then 'Alacak kapatıldı; ' || excess_amount || ' ' || rec.currency || ' fazla tahsilat eşleştirme bekliyor. ' || coalesce(p_notes, '') else p_notes end,
    auth.uid());

  return jsonb_build_object('payment_id', payment_id, 'allocated_amount', allocated_amount, 'excess_receipt_id', excess_receipt_id, 'excess_amount', excess_amount);
end
$$;

revoke all on function public.record_receivable_payment_with_excess(uuid,uuid,numeric,date,text,boolean) from public;
grant execute on function public.record_receivable_payment_with_excess(uuid,uuid,numeric,date,text,boolean) to authenticated;
