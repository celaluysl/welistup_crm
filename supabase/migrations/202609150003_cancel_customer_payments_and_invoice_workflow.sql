create or replace function public.cancel_receivable_payment(p_payment_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare payment_record public.payments%rowtype; receivable_record public.receivables%rowtype; paid_total numeric; new_status public.collection_status;
begin
  if not(public.has_permission('collections.manage') or public.has_permission('finance.manage')) or not public.has_permission('accounts.manage') then raise exception'insufficient_permission' using errcode='42501'; end if;
  if nullif(trim(p_reason),'') is null then raise exception'reason_required'; end if;
  select * into payment_record from public.payments where id=p_payment_id for update;
  if not found then raise exception'payment_not_found'; end if;
  if exists(select 1 from public.month_closes where year=extract(year from payment_record.payment_date)::integer and month=extract(month from payment_record.payment_date)::integer and status='closed') then raise exception'period_closed'; end if;
  select * into receivable_record from public.receivables where id=payment_record.receivable_id for update;
  delete from public.finance_transactions where payment_id=payment_record.id;
  delete from public.payments where id=payment_record.id;
  select coalesce(sum(amount),0) into paid_total from public.payments where receivable_id=receivable_record.id;
  new_status:=case when paid_total>=receivable_record.total_amount then'paid'::public.collection_status when paid_total>0 then'partial'::public.collection_status when receivable_record.due_date<current_date then'overdue'::public.collection_status else'pending'::public.collection_status end;
  update public.receivables set status=new_status where id=receivable_record.id;
  update public.service_periods set collection_status=new_status where id=receivable_record.service_period_id;
  insert into public.collection_activities(receivable_id,activity_type,note,created_by) values(receivable_record.id,'note','Tahsilat iptal edildi: '||trim(p_reason),auth.uid());
end$$;

grant execute on function public.cancel_receivable_payment(uuid,text) to authenticated;

create or replace function public.upsert_invoice_tracking(p_service_period_id uuid,p_status public.invoice_status,p_invoice_number text,p_invoice_date date,p_due_date date,p_notes text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare period public.service_periods%rowtype;invoice_id uuid;
begin
  if not public.has_permission('finance.manage')then raise exception'insufficient_permission'using errcode='42501';end if;
  select*into period from public.service_periods where id=p_service_period_id for update;
  if not found then raise exception'period_not_found';end if;
  if exists(select 1 from public.month_closes where year=period.year and month=period.month and status='closed')then raise exception'period_closed';end if;
  if p_status in('issued','payment_pending','partial','paid')and p_invoice_date is null then raise exception'invoice_date_required';end if;
  if p_status='cancelled'and nullif(trim(p_notes),'')is null then raise exception'cancellation_reason_required';end if;
  insert into public.invoices(service_period_id,client_id,project_id,invoice_number,invoice_date,due_date,net_amount,vat_amount,total_amount,currency,status,notes,created_by)
  values(period.id,period.client_id,period.project_id,nullif(trim(p_invoice_number),''),p_invoice_date,p_due_date,period.net_amount,period.vat_amount,period.gross_amount,period.currency,p_status,p_notes,auth.uid())
  on conflict(service_period_id)do update set invoice_number=excluded.invoice_number,invoice_date=excluded.invoice_date,due_date=excluded.due_date,status=excluded.status,notes=excluded.notes returning id into invoice_id;
  update public.service_periods set invoice_status=p_status,due_date=coalesce(p_due_date,due_date)where id=period.id;
  update public.receivables set due_date=coalesce(p_due_date,due_date)where service_period_id=period.id;
  return invoice_id;
end$$;

grant execute on function public.upsert_invoice_tracking(uuid,public.invoice_status,text,date,date,text)to authenticated;
