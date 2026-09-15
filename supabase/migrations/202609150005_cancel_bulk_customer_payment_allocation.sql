create or replace function public.cancel_receivable_payment(p_payment_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare payment_record public.payments%rowtype; receivable_record public.receivables%rowtype; paid_total numeric; new_status public.collection_status; linked_tx uuid; linked_amount numeric;
begin
  if not(public.has_permission('collections.manage') or public.has_permission('finance.manage')) or not public.has_permission('accounts.manage') then raise exception'insufficient_permission' using errcode='42501'; end if;
  if nullif(trim(p_reason),'') is null then raise exception'reason_required'; end if;
  select * into payment_record from public.payments where id=p_payment_id for update;if not found then raise exception'payment_not_found';end if;
  if exists(select 1 from public.month_closes where year=extract(year from payment_record.payment_date)::integer and month=extract(month from payment_record.payment_date)::integer and status='closed')then raise exception'period_closed';end if;
  select * into receivable_record from public.receivables where id=payment_record.receivable_id for update;
  linked_tx:=payment_record.bulk_transaction_id;
  if linked_tx is not null then
    select amount into linked_amount from public.finance_transactions where id=linked_tx for update;
    update public.finance_transactions set payment_id=null,amount=linked_amount-payment_record.amount,description=coalesce(description,'')||' · Kısmi iptal: '||trim(p_reason) where id=linked_tx and linked_amount-payment_record.amount>0;
    if linked_amount-payment_record.amount<=0 then update public.payments set bulk_transaction_id=null where id=payment_record.id;delete from public.finance_transactions where id=linked_tx;end if;
  else delete from public.finance_transactions where payment_id=payment_record.id;end if;
  delete from public.payments where id=payment_record.id;
  select coalesce(sum(amount),0)into paid_total from public.payments where receivable_id=receivable_record.id;
  new_status:=case when paid_total>=receivable_record.total_amount then'paid'::public.collection_status when paid_total>0 then'partial'::public.collection_status when receivable_record.due_date<current_date then'overdue'::public.collection_status else'pending'::public.collection_status end;
  update public.receivables set status=new_status where id=receivable_record.id;update public.service_periods set collection_status=new_status where id=receivable_record.service_period_id;
  insert into public.collection_activities(receivable_id,activity_type,note,created_by)values(receivable_record.id,'note','Tahsilat iptal edildi: '||trim(p_reason),auth.uid());
end$$;
grant execute on function public.cancel_receivable_payment(uuid,text)to authenticated;
