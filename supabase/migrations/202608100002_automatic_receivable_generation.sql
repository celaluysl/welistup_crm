create extension if not exists pg_cron;

create or replace function public.generate_service_periods_automatic(p_year integer,p_month integer)
returns integer language plpgsql security definer set search_path='' as $$
declare ps record; price record; period_start date:=make_date(p_year,p_month,1); period_end date:=(make_date(p_year,p_month,1)+interval'1 month - 1 day')::date; collection_day date; new_period uuid; count_created integer:=0;
begin
  for ps in select x.*,p.client_id from public.project_services x join public.projects p on p.id=x.project_id
    where x.status='active' and x.start_date<=period_end and(x.end_date is null or x.end_date>=period_start)
      and(x.periodicity in('monthly','variable_monthly')or(x.periodicity='one_time'and date_trunc('month',x.start_date)=period_start))
  loop
    select*into price from public.project_service_prices x where x.project_service_id=ps.id and x.effective_from<=period_end and(x.effective_to is null or x.effective_to>=period_start)order by x.effective_from desc limit 1;
    if price.id is not null then
      collection_day:=make_date(p_year,p_month,least(extract(day from ps.start_date)::integer,extract(day from period_end)::integer));
      insert into public.service_periods(project_service_id,client_id,project_id,service_id,year,month,net_amount,vat_rate,vat_amount,gross_amount,currency,billing_preference,due_date,notes,created_by)
      values(ps.id,ps.client_id,ps.project_id,ps.service_id,p_year,p_month,price.net_price,price.vat_rate,round(price.net_price*price.vat_rate/100,2),round(price.net_price*(1+price.vat_rate/100),2),price.currency,ps.billing_preference,collection_day+ps.payment_term_days,case when ps.periodicity='variable_monthly'then'Bu aya ait iş ve tutar kontrol edilmeli.'else null end,ps.created_by)
      on conflict(project_service_id,year,month)do nothing returning id into new_period;
      if new_period is not null then
        insert into public.receivables(service_period_id,client_id,project_id,total_amount,currency,due_date,created_by)
        select id,client_id,project_id,gross_amount,currency,due_date,created_by from public.service_periods where id=new_period;
        count_created:=count_created+1;new_period:=null;
      end if;
    end if;
  end loop;
  return count_created;
end$$;

create or replace function public.generate_service_periods(p_year integer,p_month integer)
returns integer language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('finance.manage')then raise exception'insufficient_permission'using errcode='42501';end if;
  return public.generate_service_periods_automatic(p_year,p_month);
end$$;

revoke all on function public.generate_service_periods_automatic(integer,integer)from public;
grant execute on function public.generate_service_periods(integer,integer)to authenticated;

update public.service_periods sp set due_date=make_date(sp.year,sp.month,least(extract(day from ps.start_date)::integer,extract(day from(make_date(sp.year,sp.month,1)+interval'1 month - 1 day'))::integer))+ps.payment_term_days
from public.project_services ps where ps.id=sp.project_service_id and sp.collection_status in('pending','partial');
update public.receivables r set due_date=sp.due_date from public.service_periods sp where sp.id=r.service_period_id and r.status in('pending','partial');

select public.generate_service_periods_automatic(extract(year from current_date)::integer,extract(month from current_date)::integer);

do $$begin
  if exists(select 1 from cron.job where jobname='welistup-daily-receivables')then perform cron.unschedule('welistup-daily-receivables');end if;
  perform cron.schedule('welistup-daily-receivables','10 0 * * *','select public.generate_service_periods_automatic(extract(year from current_date)::integer,extract(month from current_date)::integer);');
end$$;
