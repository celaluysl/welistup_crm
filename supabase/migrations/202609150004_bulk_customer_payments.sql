alter table public.payments add column if not exists bulk_transaction_id uuid references public.finance_transactions(id);

create or replace function public.record_receivables_bulk_payment(p_receivable_ids uuid[],p_account_id uuid,p_amount numeric,p_payment_date date,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare first_receivable public.receivables%rowtype; rec public.receivables%rowtype; account_currency public.currency_code; paid numeric; remaining numeric; allocation numeric; amount_left numeric:=p_amount; total_remaining numeric:=0; new_payment_id uuid; tx_id uuid; first_payment boolean:=true; new_status public.collection_status;
begin
  if not(public.has_permission('collections.manage')or public.has_permission('finance.manage'))or not public.has_permission('accounts.manage')then raise exception'insufficient_permission'using errcode='42501';end if;
  if p_receivable_ids is null or cardinality(p_receivable_ids)=0 then raise exception'receivable_not_found';end if;
  select*into first_receivable from public.receivables where id=p_receivable_ids[1]for update;if not found then raise exception'receivable_not_found';end if;
  select currency into account_currency from public.accounts where id=p_account_id and status='active';if account_currency is null or account_currency<>first_receivable.currency then raise exception'currency_mismatch_or_account_missing';end if;
  for rec in select*from public.receivables where id=any(p_receivable_ids)order by due_date nulls last,id for update loop
    if rec.client_id<>first_receivable.client_id or rec.currency<>first_receivable.currency then raise exception'mixed_customer_or_currency';end if;
    select coalesce(sum(amount),0)into paid from public.payments where receivable_id=rec.id;total_remaining:=total_remaining+greatest(rec.total_amount-paid,0);
  end loop;
  if p_amount<=0 or p_amount>total_remaining then raise exception'invalid_payment_amount';end if;
  insert into public.finance_transactions(account_id,transaction_date,transaction_type,amount,currency,client_id,category,description,created_by)values(p_account_id,p_payment_date,'income',p_amount,first_receivable.currency,first_receivable.client_id,'Toplu müşteri tahsilatı',p_notes,auth.uid())returning id into tx_id;
  for rec in select*from public.receivables where id=any(p_receivable_ids)order by due_date nulls last,id for update loop
    exit when amount_left<=0;select coalesce(sum(amount),0)into paid from public.payments where receivable_id=rec.id;remaining:=greatest(rec.total_amount-paid,0);allocation:=least(amount_left,remaining);
    if allocation>0 then
      insert into public.payments(receivable_id,amount,currency,payment_date,account_id,notes,created_by,bulk_transaction_id)values(rec.id,allocation,rec.currency,p_payment_date,p_account_id,p_notes,auth.uid(),tx_id)returning id into new_payment_id;
      if first_payment then update public.finance_transactions set payment_id=new_payment_id where id=tx_id;first_payment:=false;end if;
      amount_left:=amount_left-allocation;new_status:=case when paid+allocation>=rec.total_amount then'paid'::public.collection_status else'partial'::public.collection_status end;
      update public.receivables set status=new_status where id=rec.id;update public.service_periods set collection_status=new_status where id=rec.service_period_id;
      insert into public.collection_activities(receivable_id,activity_type,note,created_by)values(rec.id,case when new_status='paid'then'completed'::public.collection_activity_type else'partial_payment'::public.collection_activity_type end,'Toplu müşteri tahsilatından pay: '||allocation||' '||rec.currency||coalesce(' · '||nullif(trim(p_notes),''),''),auth.uid());
    end if;
  end loop;return tx_id;
end$$;
grant execute on function public.record_receivables_bulk_payment(uuid[],uuid,numeric,date,text)to authenticated;
