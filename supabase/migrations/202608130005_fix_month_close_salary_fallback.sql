create or replace function public.close_month(p_close_id uuid,p_reserve numeric,p_notes text)
returns void language plpgsql security invoker set search_path='' as $$
declare
  c public.month_closes%rowtype;
  s jsonb;
  cash_income numeric;
  cash_expense numeric;
  accrual_revenue numeric;
  manual_costs numeric;
  vendor_costs numeric;
  payroll_costs numeric;
  period_result numeric;
  cash_result numeric;
  distributable numeric;
  ownership_total numeric;
begin
  if not public.has_permission('month_close.manage') then
    raise exception'insufficient_permission' using errcode='42501';
  end if;

  select * into c from public.month_closes where id=p_close_id for update;
  if c.status='closed' then raise exception'already_closed'; end if;
  if exists(select 1 from public.month_close_checklist where month_close_id=p_close_id and not is_completed) then
    raise exception'checklist_incomplete';
  end if;

  select coalesce(sum(amount),0) into cash_income
  from public.finance_transactions
  where transaction_type='income'
    and transaction_date>=make_date(c.year,c.month,1)
    and transaction_date<(make_date(c.year,c.month,1)+interval'1 month')::date;

  select coalesce(abs(sum(amount)),0) into cash_expense
  from public.finance_transactions
  where transaction_type='expense'
    and transaction_date>=make_date(c.year,c.month,1)
    and transaction_date<(make_date(c.year,c.month,1)+interval'1 month')::date;

  select coalesce(sum(gross_amount),0) into accrual_revenue
  from public.service_periods where year=c.year and month=c.month;

  select coalesce(sum(amount),0) into manual_costs
  from public.manual_expenses where year=c.year and month=c.month and status<>'cancelled';

  select coalesce(sum(amount),0) into vendor_costs
  from public.vendor_accruals where year=c.year and month=c.month and status<>'cancelled';

  select coalesce(sum(coalesce(pp.net_payable,p.base_salary,0)),0) into payroll_costs
  from public.profiles p
  left join public.payroll_periods pp
    on pp.profile_id=p.id and pp.year=c.year and pp.month=c.month and pp.status<>'cancelled'
  where p.status='active' and p.employment_type in('partner','employee');

  period_result:=cash_income-manual_costs-vendor_costs-payroll_costs;
  cash_result:=cash_income-cash_expense;
  distributable:=greatest(period_result-p_reserve,0);

  select coalesce(sum(ownership_percent),0) into ownership_total
  from public.partner_ownerships
  where effective_from<=(make_date(c.year,c.month,1)+interval'1 month'-interval'1 day')::date
    and(effective_to is null or effective_to>=make_date(c.year,c.month,1));
  if distributable>0 and abs(ownership_total-100)>0.0001 then
    raise exception'ownership_total_must_be_100';
  end if;

  select jsonb_build_object(
    'accrual_revenue',accrual_revenue,
    'cash_collections',cash_income,
    'cash_expenses',cash_expense,
    'cash_result',cash_result,
    'manual_expense_costs',manual_costs,
    'vendor_costs',vendor_costs,
    'payroll_costs',payroll_costs,
    'total_costs',manual_costs+vendor_costs+payroll_costs,
    'period_result',period_result,
    'reserve_amount',p_reserve,
    'distributable_profit',distributable,
    'account_balances',(select coalesce(jsonb_object_agg(a.name,b.balance),'{}'::jsonb) from public.account_balances() b join public.accounts a on a.id=b.account_id)
  ) into s;

  delete from public.profit_distributions where month_close_id=p_close_id;
  insert into public.profit_distributions(month_close_id,profile_id,ownership_percent,amount)
  select p_close_id,profile_id,ownership_percent,round(distributable*ownership_percent/100,2)
  from public.partner_ownerships
  where effective_from<=(make_date(c.year,c.month,1)+interval'1 month'-interval'1 day')::date
    and(effective_to is null or effective_to>=make_date(c.year,c.month,1));

  update public.month_closes
  set status='closed',reserve_amount=p_reserve,notes=p_notes,snapshot=s,
      closed_by=auth.uid(),closed_at=now()
  where id=p_close_id;
end$$;

grant execute on function public.close_month(uuid,numeric,text) to authenticated;
