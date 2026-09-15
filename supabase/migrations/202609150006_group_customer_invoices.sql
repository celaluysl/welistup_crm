create or replace function public.upsert_customer_invoice_group(p_service_period_ids uuid[],p_status public.invoice_status,p_invoice_number text,p_invoice_date date,p_due_date date,p_notes text)
returns uuid[] language plpgsql security invoker set search_path=''as $$
declare first_period public.service_periods%rowtype;period public.service_periods%rowtype;result uuid[]:='{}';invoice_id uuid;
begin
 if not public.has_permission('finance.manage')then raise exception'insufficient_permission'using errcode='42501';end if;
 if p_service_period_ids is null or cardinality(p_service_period_ids)=0 then raise exception'period_not_found';end if;
 select*into first_period from public.service_periods where id=p_service_period_ids[1];if not found then raise exception'period_not_found';end if;
 for period in select*from public.service_periods where id=any(p_service_period_ids)order by id loop
  if period.client_id<>first_period.client_id or period.year<>first_period.year or period.month<>first_period.month or period.currency<>first_period.currency then raise exception'mixed_customer_or_period';end if;
  invoice_id:=public.upsert_invoice_tracking(period.id,p_status,p_invoice_number,p_invoice_date,p_due_date,p_notes);result:=array_append(result,invoice_id);
 end loop;return result;
end$$;
grant execute on function public.upsert_customer_invoice_group(uuid[],public.invoice_status,text,date,date,text)to authenticated;
