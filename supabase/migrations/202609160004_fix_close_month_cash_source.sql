create or replace function public.close_month(p_close_id uuid,p_reserve numeric,p_notes text)
returns void language plpgsql security invoker set search_path='' as $$
declare
  c public.month_closes%rowtype; s jsonb; cash_summary jsonb; month_start date; month_end date;
  cash_income numeric; cash_expense numeric; accrual_revenue numeric;
  invoiced_cost numeric; uninvoiced_cost numeric; payroll_costs numeric;
  period_result numeric; cash_result numeric; invoiced_target numeric;
  uninvoiced_target numeric; distributable numeric; ownership_total numeric;
begin
  if not public.has_permission('month_close.manage') then raise exception'insufficient_permission' using errcode='42501'; end if;
  select * into c from public.month_closes where id=p_close_id for update;
  if c.status='closed' then raise exception'already_closed'; end if;
  if exists(select 1 from public.month_close_checklist where month_close_id=p_close_id and not is_completed) then raise exception'checklist_incomplete'; end if;
  month_start:=make_date(c.year,c.month,1); month_end:=(month_start+interval'1 month'-interval'1 day')::date;
  select public.monthly_collection_cash_summary(c.year,c.month) into cash_summary;
  cash_income:=coalesce((cash_summary->>'total')::numeric,0);
  select coalesce(abs(sum(amount)),0) into cash_expense from public.finance_transactions where transaction_type='expense' and transaction_date between month_start and month_end;
  select coalesce(sum(gross_amount),0) into accrual_revenue from public.service_periods where year=c.year and month=c.month;
  select coalesce(sum(p.amount) filter(where e.billing_preference='invoiced'),0),coalesce(sum(p.amount) filter(where e.billing_preference='uninvoiced'),0)
  into invoiced_cost,uninvoiced_cost from public.manual_expenses e left join public.manual_expense_payments p on p.manual_expense_id=e.id where e.year=c.year and e.month=c.month and e.status<>'cancelled';
  select invoiced_cost+coalesce(sum(p.amount) filter(where a.billing_preference='invoiced' and coalesce(p.payment_channel,'company_cash')<>'client_direct'),0),uninvoiced_cost+coalesce(sum(p.amount) filter(where a.billing_preference='uninvoiced' and coalesce(p.payment_channel,'company_cash')<>'client_direct'),0)
  into invoiced_cost,uninvoiced_cost from public.vendor_accruals a left join public.vendor_payments p on p.vendor_accrual_id=a.id where a.year=c.year and a.month=c.month and a.status<>'cancelled';
  select coalesce(sum(coalesce(pp.net_payable,p.base_salary,0)),0) into payroll_costs from public.profiles p left join public.payroll_periods pp on pp.profile_id=p.id and pp.year=c.year and pp.month=c.month and pp.status<>'cancelled' where p.status='active' and p.employment_type in('partner','employee');
  select coalesce(opening_balance,0) into invoiced_target from public.accounts where status='active' and name='Şirket Gider Kasası' limit 1;
  select coalesce(opening_balance,0) into uninvoiced_target from public.accounts where status='active' and name='Faturasız Gider Kasası' limit 1;
  period_result:=cash_income-invoiced_cost-uninvoiced_cost-payroll_costs;
  cash_result:=cash_income-cash_expense;
  distributable:=greatest(period_result-p_reserve,0);
  select coalesce(sum(ownership_percent),0) into ownership_total from public.partner_ownerships where effective_from<=month_end and(effective_to is null or effective_to>=month_start);
  if distributable>0 and abs(ownership_total-100)>0.0001 then raise exception'ownership_total_must_be_100'; end if;
  select jsonb_build_object('accrual_revenue',accrual_revenue,'cash_collections',cash_income,'cash_expenses',cash_expense,'cash_result',cash_result,'invoiced_expense_costs',invoiced_cost,'uninvoiced_expense_costs',uninvoiced_cost,'payroll_costs',payroll_costs,'total_costs',invoiced_cost+uninvoiced_cost+payroll_costs,'period_result',period_result,'invoiced_cash_target',coalesce(invoiced_target,0),'uninvoiced_cash_target',coalesce(uninvoiced_target,0),'invoiced_cash_top_up',invoiced_cost,'uninvoiced_cash_top_up',uninvoiced_cost,'reserve_amount',p_reserve,'distributable_profit',distributable) into s;
  delete from public.profit_distributions where month_close_id=p_close_id;
  insert into public.profit_distributions(month_close_id,profile_id,ownership_percent,amount) select p_close_id,profile_id,ownership_percent,round(distributable*ownership_percent/100,2) from public.partner_ownerships where effective_from<=month_end and(effective_to is null or effective_to>=month_start);
  update public.month_closes set status='closed',reserve_amount=p_reserve,notes=p_notes,snapshot=s,closed_by=auth.uid(),closed_at=now() where id=p_close_id;
end$$;

grant execute on function public.close_month(uuid,numeric,text) to authenticated;
