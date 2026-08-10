alter table public.project_services
  add column if not exists payment_interval_months integer not null default 1 check(payment_interval_months in(1,3,6,9,12)),
  add column if not exists payment_timing text not null default 'advance' check(payment_timing in('advance','arrears'));

alter table public.receivables
  add column if not exists coverage_start date,
  add column if not exists coverage_end date;

update public.receivables r set coverage_start=make_date(sp.year,sp.month,1),coverage_end=(make_date(sp.year,sp.month,1)+interval'1 month - 1 day')::date
from public.service_periods sp where sp.id=r.service_period_id and r.coverage_start is null;

create or replace function public.create_project_with_services(
  p_client_id uuid,p_name text,p_domain text,p_start_date date,p_specialist_id uuid,
  p_billing_preference public.billing_preference,p_is_white_label boolean,p_description text,p_services jsonb
)returns uuid language plpgsql security invoker set search_path=''as $$
declare project_id uuid;item jsonb;new_project_service uuid;
begin
  if not(public.has_permission('projects.manage')and public.has_permission('finance.manage'))then raise exception'insufficient_permission'using errcode='42501';end if;
  perform public.enforce_single_service_payload(p_services);
  if jsonb_array_length(p_services)<>1 then raise exception'project_requires_one_service';end if;
  if not exists(select 1 from public.profiles where id=p_specialist_id and status='active')then raise exception'specialist_not_active';end if;
  insert into public.projects(client_id,name,domain,start_date,billing_preference,is_white_label,description,created_by,updated_by)
  values(p_client_id,p_name,nullif(trim(p_domain),''),p_start_date,p_billing_preference,p_is_white_label,p_description,auth.uid(),auth.uid())returning id into project_id;
  item:=p_services->0;
  insert into public.project_services(project_id,service_id,periodicity,currency,billing_preference,start_date,payment_term_days,payment_interval_months,payment_timing,status,notes,created_by,updated_by)
  values(project_id,(item->>'service_id')::uuid,(item->>'periodicity')::public.service_periodicity,(item->>'currency')::public.currency_code,p_billing_preference,p_start_date,(item->>'payment_term_days')::integer,coalesce((item->>'payment_interval_months')::integer,1),coalesce(item->>'payment_timing','advance'),'active',nullif(item->>'notes',''),auth.uid(),auth.uid())returning id into new_project_service;
  insert into public.project_service_prices(project_service_id,net_price,vat_rate,currency,effective_from,created_by)
  values(new_project_service,(item->>'net_price')::numeric,(item->>'vat_rate')::numeric,(item->>'currency')::public.currency_code,p_start_date,auth.uid());
  insert into public.project_service_members(project_service_id,profile_id)values(new_project_service,p_specialist_id);
  return project_id;
end$$;

create or replace function public.update_project_with_new_services(
  p_project_id uuid,p_client_id uuid,p_name text,p_domain text,p_start_date date,p_specialist_id uuid,
  p_billing_preference public.billing_preference,p_is_white_label boolean,p_description text,p_services jsonb
)returns void language plpgsql security invoker set search_path=''as $$
declare item jsonb;active_project_service uuid;active_price uuid;
begin
  if not(public.has_permission('projects.manage')and public.has_permission('finance.manage'))then raise exception'insufficient_permission'using errcode='42501';end if;
  perform public.enforce_single_service_payload(p_services);
  if jsonb_array_length(coalesce(p_services,'[]'::jsonb))<>1 then raise exception'project_requires_one_service';end if;
  if not exists(select 1 from public.profiles where id=p_specialist_id and status='active')then raise exception'specialist_not_active';end if;
  update public.projects set client_id=p_client_id,name=p_name,domain=nullif(trim(p_domain),''),start_date=p_start_date,billing_preference=p_billing_preference,is_white_label=p_is_white_label,description=p_description,updated_by=auth.uid()where id=p_project_id;
  if not found then raise exception'project_not_found';end if;
  item:=p_services->0;
  select id into active_project_service from public.project_services where project_id=p_project_id and status='active'order by created_at limit 1;
  if active_project_service is null then
    insert into public.project_services(project_id,service_id,periodicity,currency,billing_preference,start_date,payment_term_days,payment_interval_months,payment_timing,status,notes,created_by,updated_by)
    values(p_project_id,(item->>'service_id')::uuid,(item->>'periodicity')::public.service_periodicity,(item->>'currency')::public.currency_code,p_billing_preference,p_start_date,(item->>'payment_term_days')::integer,coalesce((item->>'payment_interval_months')::integer,1),coalesce(item->>'payment_timing','advance'),'active',nullif(item->>'notes',''),auth.uid(),auth.uid())returning id into active_project_service;
  else
    update public.project_services set service_id=(item->>'service_id')::uuid,periodicity=(item->>'periodicity')::public.service_periodicity,currency=(item->>'currency')::public.currency_code,billing_preference=p_billing_preference,start_date=p_start_date,payment_term_days=(item->>'payment_term_days')::integer,payment_interval_months=coalesce((item->>'payment_interval_months')::integer,1),payment_timing=coalesce(item->>'payment_timing','advance'),notes=nullif(item->>'notes',''),updated_by=auth.uid()where id=active_project_service;
  end if;
  select id into active_price from public.project_service_prices where project_service_id=active_project_service order by(effective_to is null)desc,effective_from desc limit 1;
  if active_price is null then
    insert into public.project_service_prices(project_service_id,net_price,vat_rate,currency,effective_from,created_by)values(active_project_service,(item->>'net_price')::numeric,(item->>'vat_rate')::numeric,(item->>'currency')::public.currency_code,p_start_date,auth.uid());
  else
    update public.project_service_prices set net_price=(item->>'net_price')::numeric,vat_rate=(item->>'vat_rate')::numeric,currency=(item->>'currency')::public.currency_code where id=active_price;
  end if;
  delete from public.project_service_members where project_service_id=active_project_service;
  insert into public.project_service_members(project_service_id,profile_id)values(active_project_service,p_specialist_id);
end$$;

create or replace function public.generate_service_periods_automatic(p_year integer,p_month integer)
returns integer language plpgsql security definer set search_path=''as $$
declare ps record;price record;period_start date:=make_date(p_year,p_month,1);period_end date:=(make_date(p_year,p_month,1)+interval'1 month - 1 day')::date;collection_day date;period_id uuid;elapsed integer;should_collect boolean;coverage_from date;coverage_to date;count_created integer:=0;
begin
  for ps in select x.*,p.client_id from public.project_services x join public.projects p on p.id=x.project_id where x.status='active'and x.start_date<=period_end and(x.end_date is null or x.end_date>=period_start)and(x.periodicity in('monthly','variable_monthly')or(x.periodicity='one_time'and date_trunc('month',x.start_date)=period_start))
  loop
    select*into price from public.project_service_prices x where x.project_service_id=ps.id and x.effective_from<=period_end and(x.effective_to is null or x.effective_to>=period_start)order by x.effective_from desc limit 1;
    if price.id is not null then
      insert into public.service_periods(project_service_id,client_id,project_id,service_id,year,month,net_amount,vat_rate,vat_amount,gross_amount,currency,billing_preference,due_date,notes,created_by)
      values(ps.id,ps.client_id,ps.project_id,ps.service_id,p_year,p_month,price.net_price,price.vat_rate,round(price.net_price*price.vat_rate/100,2),round(price.net_price*(1+price.vat_rate/100),2),price.currency,ps.billing_preference,null,case when ps.periodicity='variable_monthly'then'Bu aya ait iş ve tutar kontrol edilmeli.'else null end,ps.created_by)
      on conflict(project_service_id,year,month)do update set billing_preference=excluded.billing_preference returning id into period_id;
      elapsed:=(p_year*12+p_month)-(extract(year from ps.start_date)::integer*12+extract(month from ps.start_date)::integer);
      should_collect:=ps.periodicity='one_time'or(case when ps.payment_timing='advance'then mod(elapsed,ps.payment_interval_months)=0 else mod(elapsed+1,ps.payment_interval_months)=0 end);
      if should_collect and not exists(select 1 from public.receivables where service_period_id=period_id)then
        collection_day:=make_date(p_year,p_month,least(extract(day from ps.start_date)::integer,extract(day from period_end)::integer));
        if ps.payment_timing='advance'then coverage_from:=period_start;coverage_to:=(period_start+(ps.payment_interval_months||' months')::interval-interval'1 day')::date;
        else coverage_from:=(period_start-((ps.payment_interval_months-1)||' months')::interval)::date;coverage_to:=period_end;end if;
        update public.service_periods set due_date=collection_day+ps.payment_term_days where id=period_id;
        insert into public.receivables(service_period_id,client_id,project_id,total_amount,currency,due_date,coverage_start,coverage_end,created_by)
        values(period_id,ps.client_id,ps.project_id,round(price.net_price*(1+price.vat_rate/100)*ps.payment_interval_months,2),price.currency,collection_day+ps.payment_term_days,coverage_from,coverage_to,ps.created_by);
        count_created:=count_created+1;
      end if;
    end if;
  end loop;
  return count_created;
end$$;
