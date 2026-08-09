alter table public.unallocated_customer_receipts
  add column service_id uuid references public.services(id),
  add column custom_service_name text,
  add column classified_at timestamptz,
  add column classified_by uuid references public.profiles(id),
  add constraint unallocated_receipt_service_check check (
    status <> 'allocated' or service_id is not null or nullif(trim(custom_service_name), '') is not null
  );

create or replace function public.classify_unallocated_customer_receipt(
  p_receipt_id uuid,
  p_service_id uuid,
  p_custom_service_name text,
  p_notes text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt public.unallocated_customer_receipts%rowtype;
  service_name text;
  classification_name text;
begin
  if not (public.has_permission('collections.manage') or public.has_permission('finance.manage')) then
    raise exception 'insufficient_permission' using errcode = '42501';
  end if;
  select * into receipt from public.unallocated_customer_receipts where id = p_receipt_id for update;
  if not found then raise exception 'receipt_not_found'; end if;
  if receipt.status not in ('unidentified', 'available') or receipt.remaining_amount <= 0 then
    raise exception 'receipt_already_classified';
  end if;
  if p_service_id is not null then
    select name into service_name from public.services where id = p_service_id and status = 'active';
    if service_name is null then raise exception 'service_not_found'; end if;
  end if;
  classification_name := coalesce(service_name, nullif(trim(p_custom_service_name), ''));
  if classification_name is null then raise exception 'classification_required'; end if;

  update public.unallocated_customer_receipts
  set status = 'allocated',
      remaining_amount = 0,
      service_id = p_service_id,
      custom_service_name = case when p_service_id is null then classification_name else null end,
      notes = coalesce(nullif(trim(p_notes), ''), notes),
      classified_at = now(),
      classified_by = auth.uid()
  where id = p_receipt_id;

  update public.finance_transactions
  set service_id = p_service_id,
      category = 'Tek seferlik hizmet tahsilatı',
      description = classification_name || case when nullif(trim(p_notes), '') is null then '' else ' · ' || trim(p_notes) end
  where id = receipt.transaction_id;
end
$$;

revoke all on function public.classify_unallocated_customer_receipt(uuid,uuid,text,text) from public;
grant execute on function public.classify_unallocated_customer_receipt(uuid,uuid,text,text) to authenticated;
