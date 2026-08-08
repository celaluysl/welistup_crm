-- Atomic project service and price-history workflows.
create or replace function public.create_project_service_with_price(
  p_project_id uuid, p_service_id uuid, p_periodicity public.service_periodicity,
  p_currency public.currency_code, p_billing_preference public.billing_preference,
  p_start_date date, p_payment_term_days integer, p_notes text,
  p_net_price numeric, p_vat_rate numeric
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_id uuid;
begin
  if not public.has_permission('projects.manage') or not public.has_permission('finance.manage') then
    raise exception 'insufficient_permission' using errcode = '42501';
  end if;
  insert into public.project_services(project_id,service_id,periodicity,currency,billing_preference,start_date,payment_term_days,notes,created_by,updated_by)
  values(p_project_id,p_service_id,p_periodicity,p_currency,p_billing_preference,p_start_date,p_payment_term_days,p_notes,auth.uid(),auth.uid()) returning id into new_id;
  insert into public.project_service_prices(project_service_id,net_price,vat_rate,currency,effective_from,created_by)
  values(new_id,p_net_price,p_vat_rate,p_currency,p_start_date,auth.uid());
  return new_id;
end $$;

create or replace function public.change_project_service_price(
  p_project_service_id uuid, p_net_price numeric, p_vat_rate numeric,
  p_currency public.currency_code, p_effective_from date
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_id uuid; current_start date;
begin
  if not public.has_permission('finance.manage') then raise exception 'insufficient_permission' using errcode='42501'; end if;
  select effective_from into current_start from public.project_service_prices
    where project_service_id=p_project_service_id and effective_to is null for update;
  if current_start is not null and p_effective_from <= current_start then raise exception 'new_price_date_must_be_later'; end if;
  update public.project_service_prices set effective_to=p_effective_from-1
    where project_service_id=p_project_service_id and effective_to is null;
  insert into public.project_service_prices(project_service_id,net_price,vat_rate,currency,effective_from,created_by)
  values(p_project_service_id,p_net_price,p_vat_rate,p_currency,p_effective_from,auth.uid()) returning id into new_id;
  return new_id;
end $$;

grant execute on function public.create_project_service_with_price(uuid,uuid,public.service_periodicity,public.currency_code,public.billing_preference,date,integer,text,numeric,numeric) to authenticated;
grant execute on function public.change_project_service_price(uuid,numeric,numeric,public.currency_code,date) to authenticated;
