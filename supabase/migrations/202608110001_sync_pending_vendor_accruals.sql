create or replace function public.sync_pending_vendor_accruals_from_assignment()
returns trigger language plpgsql security invoker set search_path='' as $$
declare current_year integer:=extract(year from current_date)::integer; current_month integer:=extract(month from current_date)::integer; effective_vat numeric; effective_net numeric;
begin
  effective_net:=case when new.payment_model='monthly_variable' then 0 else new.default_amount end;
  effective_vat:=case when new.billing_preference='invoiced' then new.vat_rate else 0 end;
  update public.vendor_accruals a set
    net_amount=effective_net,
    vat_rate=effective_vat,
    vat_amount=round(effective_net*effective_vat/100,2),
    amount=round(effective_net*(1+effective_vat/100),2),
    currency=new.currency,
    billing_preference=new.billing_preference,
    due_date=make_date(a.year,a.month,least(new.payment_day,extract(day from(make_date(a.year,a.month,1)+interval'1 month - 1 day'))::integer)),
    requires_amount_review=new.payment_model='monthly_variable',
    notes=case when new.payment_model='monthly_variable' then'Bu aya ait proje bedeli girilmeli.'else new.notes end
  where a.vendor_assignment_id=new.id
    and a.status='pending'
    and(a.year>current_year or(a.year=current_year and a.month>=current_month))
    and not exists(select 1 from public.vendor_payments vp where vp.vendor_accrual_id=a.id);

  update public.service_periods sp set cost_amount=coalesce((select sum(a.amount)from public.vendor_accruals a where a.project_service_id=sp.project_service_id and a.year=sp.year and a.month=sp.month and a.status<>'cancelled'),0)
  where sp.project_service_id=new.project_service_id and(sp.year>current_year or(sp.year=current_year and sp.month>=current_month));
  return new;
end$$;

drop trigger if exists sync_pending_vendor_accruals on public.vendor_assignments;
create trigger sync_pending_vendor_accruals after update of default_amount,currency,payment_model,billing_preference,vat_rate,payment_day,notes on public.vendor_assignments for each row execute function public.sync_pending_vendor_accruals_from_assignment();

update public.vendor_assignments set default_amount=default_amount where status='active';
