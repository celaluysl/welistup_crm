drop function if exists public.create_project_with_services(uuid,text,text,date,public.billing_preference,boolean,text,jsonb);
drop function if exists public.update_project_with_new_services(uuid,uuid,text,text,date,public.billing_preference,boolean,text,jsonb);

create function public.create_project_with_services(
  p_client_id uuid,
  p_name text,
  p_domain text,
  p_start_date date,
  p_specialist_id uuid,
  p_billing_preference public.billing_preference,
  p_is_white_label boolean,
  p_description text,
  p_services jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  project_id uuid;
  item jsonb;
  new_project_service uuid;
begin
  if not(public.has_permission('projects.manage') and public.has_permission('finance.manage')) then
    raise exception 'insufficient_permission' using errcode='42501';
  end if;
  perform public.enforce_single_service_payload(p_services);
  if jsonb_array_length(p_services) <> 1 then raise exception 'project_requires_one_service'; end if;
  if not exists(select 1 from public.profiles where id=p_specialist_id and status='active') then
    raise exception 'specialist_not_active';
  end if;
  insert into public.projects(client_id,name,domain,start_date,billing_preference,is_white_label,description,created_by,updated_by)
  values(p_client_id,p_name,nullif(trim(p_domain),''),p_start_date,p_billing_preference,p_is_white_label,p_description,auth.uid(),auth.uid())
  returning id into project_id;
  item:=p_services->0;
  insert into public.project_services(project_id,service_id,periodicity,currency,billing_preference,start_date,payment_term_days,status,notes,created_by,updated_by)
  values(project_id,(item->>'service_id')::uuid,(item->>'periodicity')::public.service_periodicity,(item->>'currency')::public.currency_code,p_billing_preference,p_start_date,(item->>'payment_term_days')::integer,'active',nullif(item->>'notes',''),auth.uid(),auth.uid())
  returning id into new_project_service;
  insert into public.project_service_prices(project_service_id,net_price,vat_rate,currency,effective_from,created_by)
  values(new_project_service,(item->>'net_price')::numeric,(item->>'vat_rate')::numeric,(item->>'currency')::public.currency_code,p_start_date,auth.uid());
  insert into public.project_service_members(project_service_id,profile_id)
  values(new_project_service,p_specialist_id);
  return project_id;
end $$;

create function public.update_project_with_new_services(
  p_project_id uuid,
  p_client_id uuid,
  p_name text,
  p_domain text,
  p_start_date date,
  p_specialist_id uuid,
  p_billing_preference public.billing_preference,
  p_is_white_label boolean,
  p_description text,
  p_services jsonb
) returns void language plpgsql security invoker set search_path='' as $$
declare
  item jsonb;
  active_project_service uuid;
begin
  if not(public.has_permission('projects.manage') and public.has_permission('finance.manage')) then
    raise exception 'insufficient_permission' using errcode='42501';
  end if;
  perform public.enforce_single_service_payload(p_services);
  if jsonb_array_length(coalesce(p_services,'[]'::jsonb))=1 and exists(select 1 from public.project_services where project_id=p_project_id and status='active') then
    raise exception 'project_already_has_service';
  end if;
  if not exists(select 1 from public.profiles where id=p_specialist_id and status='active') then
    raise exception 'specialist_not_active';
  end if;
  update public.projects set client_id=p_client_id,name=p_name,domain=nullif(trim(p_domain),''),start_date=p_start_date,billing_preference=p_billing_preference,is_white_label=p_is_white_label,description=p_description,updated_by=auth.uid()
  where id=p_project_id;
  if not found then raise exception 'project_not_found'; end if;
  update public.project_services set billing_preference=p_billing_preference,updated_by=auth.uid()
  where project_id=p_project_id and status='active';
  select id into active_project_service from public.project_services where project_id=p_project_id and status='active' order by created_at limit 1;
  if active_project_service is null and jsonb_array_length(coalesce(p_services,'[]'::jsonb))=1 then
    item:=p_services->0;
    insert into public.project_services(project_id,service_id,periodicity,currency,billing_preference,start_date,payment_term_days,status,notes,created_by,updated_by)
    values(p_project_id,(item->>'service_id')::uuid,(item->>'periodicity')::public.service_periodicity,(item->>'currency')::public.currency_code,p_billing_preference,p_start_date,(item->>'payment_term_days')::integer,'active',nullif(item->>'notes',''),auth.uid(),auth.uid())
    returning id into active_project_service;
    insert into public.project_service_prices(project_service_id,net_price,vat_rate,currency,effective_from,created_by)
    values(active_project_service,(item->>'net_price')::numeric,(item->>'vat_rate')::numeric,(item->>'currency')::public.currency_code,p_start_date,auth.uid());
  end if;
  if active_project_service is null then raise exception 'project_requires_one_service'; end if;
  delete from public.project_service_members where project_service_id=active_project_service;
  insert into public.project_service_members(project_service_id,profile_id) values(active_project_service,p_specialist_id);
end $$;

grant execute on function public.create_project_with_services(uuid,text,text,date,uuid,public.billing_preference,boolean,text,jsonb) to authenticated;
grant execute on function public.update_project_with_new_services(uuid,uuid,text,text,date,uuid,public.billing_preference,boolean,text,jsonb) to authenticated;
