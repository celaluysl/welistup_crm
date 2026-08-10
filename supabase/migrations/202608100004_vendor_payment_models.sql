alter table public.vendor_assignments
  add column payment_model text not null default 'monthly_fixed'
    check(payment_model in('monthly_fixed','monthly_variable','one_time')),
  add column billing_preference public.billing_preference not null default 'uninvoiced',
  add column vat_rate numeric(5,2) not null default 0 check(vat_rate between 0 and 100),
  add column payment_day integer not null default 28 check(payment_day between 1 and 31);

alter table public.vendor_accruals
  add column net_amount numeric(18,2) not null default 0 check(net_amount>=0),
  add column vat_rate numeric(5,2) not null default 0 check(vat_rate between 0 and 100),
  add column vat_amount numeric(18,2) not null default 0 check(vat_amount>=0),
  add column billing_preference public.billing_preference not null default 'uninvoiced',
  add column requires_amount_review boolean not null default false;

update public.vendor_accruals set net_amount=amount;

create or replace function public.generate_vendor_accruals_automatic(p_year integer,p_month integer)
returns integer language plpgsql security definer set search_path='' as $$
declare a record; period_start date:=make_date(p_year,p_month,1); period_end date:=(make_date(p_year,p_month,1)+interval'1 month - 1 day')::date; net numeric; vat numeric; gross numeric; created_count integer:=0;
begin
  for a in
    select va.*,ps.project_id from public.vendor_assignments va join public.project_services ps on ps.id=va.project_service_id
    where va.status='active' and va.start_date<=period_end and(va.end_date is null or va.end_date>=period_start)
      and(va.payment_model<>'one_time' or date_trunc('month',va.start_date)=period_start)
  loop
    net:=case when a.payment_model='monthly_variable' then 0 else a.default_amount end;
    vat:=case when a.billing_preference='invoiced' then a.vat_rate else 0 end;
    gross:=round(net*(1+vat/100),2);
    insert into public.vendor_accruals(vendor_id,vendor_assignment_id,project_id,project_service_id,year,month,net_amount,vat_rate,vat_amount,amount,currency,billing_preference,due_date,requires_amount_review,notes,created_by)
    values(a.vendor_id,a.id,a.project_id,a.project_service_id,p_year,p_month,net,vat,round(net*vat/100,2),gross,a.currency,case when a.billing_preference='invoiced' then'invoiced'::public.billing_preference else'uninvoiced'::public.billing_preference end,make_date(p_year,p_month,least(a.payment_day,extract(day from period_end)::integer)),a.payment_model='monthly_variable',case when a.payment_model='monthly_variable' then'Bu aya ait proje bedeli girilmeli.'else a.notes end,a.created_by)
    on conflict(vendor_assignment_id,year,month)do nothing;
    if found then created_count:=created_count+1;end if;
  end loop;
  update public.service_periods sp set cost_amount=coalesce((select sum(va.amount)from public.vendor_accruals va where va.project_service_id=sp.project_service_id and va.year=p_year and va.month=p_month and va.status<>'cancelled'),0)where sp.year=p_year and sp.month=p_month;
  return created_count;
end$$;

create or replace function public.generate_vendor_accruals(p_year integer,p_month integer)
returns integer language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('vendors.manage')then raise exception'insufficient_permission'using errcode='42501';end if;
  return public.generate_vendor_accruals_automatic(p_year,p_month);
end$$;

create or replace function public.update_vendor_accrual_amount(p_accrual_id uuid,p_net_amount numeric,p_notes text)
returns void language plpgsql security invoker set search_path='' as $$
declare a public.vendor_accruals%rowtype; calculated_vat numeric; calculated_gross numeric;
begin
  if not public.has_permission('vendors.manage')then raise exception'insufficient_permission'using errcode='42501';end if;
  if p_net_amount<0 then raise exception'invalid_amount';end if;
  select*into a from public.vendor_accruals where id=p_accrual_id for update;
  if not found then raise exception'accrual_not_found';end if;
  if exists(select 1 from public.vendor_payments where vendor_accrual_id=a.id)then raise exception'accrual_has_payments';end if;
  calculated_vat:=case when a.billing_preference='invoiced' then round(p_net_amount*a.vat_rate/100,2)else 0 end;
  calculated_gross:=p_net_amount+calculated_vat;
  update public.vendor_accruals set net_amount=p_net_amount,vat_amount=calculated_vat,amount=calculated_gross,requires_amount_review=false,notes=nullif(trim(p_notes),'')where id=a.id;
  update public.service_periods set cost_amount=coalesce((select sum(x.amount)from public.vendor_accruals x where x.project_service_id=a.project_service_id and x.year=a.year and x.month=a.month and x.status<>'cancelled'),0)where project_service_id=a.project_service_id and year=a.year and month=a.month;
end$$;

create or replace function public.pay_vendor_accrual(p_accrual_id uuid,p_account_id uuid,p_amount numeric,p_payment_date date,p_notes text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare accrual public.vendor_accruals%rowtype; account_currency public.currency_code; account_billing public.billing_preference; paid numeric; tx_id uuid; payment_id uuid; new_status public.accrual_status;
begin
  if not(public.has_permission('vendors.manage')and public.has_permission('accounts.manage'))then raise exception'insufficient_permission'using errcode='42501';end if;
  select*into accrual from public.vendor_accruals where id=p_accrual_id for update;
  if not found then raise exception'accrual_not_found';end if;
  if accrual.requires_amount_review then raise exception'amount_review_required';end if;
  select currency,billing_preference into account_currency,account_billing from public.accounts where id=p_account_id and status='active';
  if account_currency is null or account_currency<>accrual.currency then raise exception'currency_mismatch_or_account_missing';end if;
  if account_billing<>accrual.billing_preference then raise exception'billing_preference_mismatch';end if;
  select coalesce(sum(amount),0)into paid from public.vendor_payments where vendor_accrual_id=p_accrual_id;
  if p_amount<=0 or paid+p_amount>accrual.amount then raise exception'invalid_payment_amount';end if;
  insert into public.finance_transactions(account_id,transaction_date,transaction_type,amount,currency,project_id,vendor_id,category,description,created_by)values(p_account_id,p_payment_date,'expense',-p_amount,accrual.currency,accrual.project_id,accrual.vendor_id,'Tedarikçi ödemesi',p_notes,auth.uid())returning id into tx_id;
  insert into public.vendor_payments(vendor_accrual_id,account_id,amount,currency,payment_date,transaction_id,notes,created_by)values(p_accrual_id,p_account_id,p_amount,accrual.currency,p_payment_date,tx_id,p_notes,auth.uid())returning id into payment_id;
  paid:=paid+p_amount;new_status:=case when paid>=accrual.amount then'paid'::public.accrual_status else'partial'::public.accrual_status end;
  update public.vendor_accruals set status=new_status where id=p_accrual_id;
  return payment_id;
end$$;

revoke all on function public.generate_vendor_accruals_automatic(integer,integer)from public;
grant execute on function public.generate_vendor_accruals(integer,integer)to authenticated;
grant execute on function public.update_vendor_accrual_amount(uuid,numeric,text)to authenticated;
grant execute on function public.pay_vendor_accrual(uuid,uuid,numeric,date,text)to authenticated;

select public.generate_vendor_accruals_automatic(extract(year from current_date)::integer,extract(month from current_date)::integer);
do $$begin
  if exists(select 1 from cron.job where jobname='welistup-daily-vendor-accruals')then perform cron.unschedule('welistup-daily-vendor-accruals');end if;
  perform cron.schedule('welistup-daily-vendor-accruals','20 0 * * *','select public.generate_vendor_accruals_automatic(extract(year from current_date)::integer,extract(month from current_date)::integer);');
end$$;
