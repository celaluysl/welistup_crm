create or replace function public.update_payroll_payment(p_payment_id uuid,p_account_id uuid,p_amount numeric,p_payment_date date,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare payment public.payroll_payments%rowtype;payroll public.payroll_periods%rowtype;account_currency public.currency_code;other_paid numeric;total_paid numeric;
begin
  if not(public.has_permission('payroll.manage')and public.has_permission('accounts.manage'))then raise exception'insufficient_permission'using errcode='42501';end if;
  if p_amount<=0 then raise exception'invalid_payment_amount';end if;
  select*into payment from public.payroll_payments where id=p_payment_id for update;
  if not found then raise exception'payment_not_found';end if;
  select*into payroll from public.payroll_periods where id=payment.payroll_period_id for update;
  if exists(select 1 from public.month_closes where year=payroll.year and month=payroll.month and status='closed')then raise exception'period_closed';end if;
  select currency into account_currency from public.accounts where id=p_account_id and status='active';
  if account_currency is null or account_currency<>payroll.currency then raise exception'currency_mismatch';end if;
  select coalesce(sum(amount),0)into other_paid from public.payroll_payments where payroll_period_id=payroll.id and id<>payment.id;
  if other_paid+p_amount>payroll.net_payable then raise exception'invalid_payment_amount';end if;
  update public.payroll_payments set account_id=p_account_id,amount=p_amount,payment_date=p_payment_date,notes=p_notes where id=p_payment_id;
  update public.finance_transactions set account_id=p_account_id,transaction_date=p_payment_date,amount=-p_amount,description=p_notes where id=payment.transaction_id;
  total_paid:=other_paid+p_amount;
  update public.payroll_periods set status=case when total_paid>=net_payable then'paid'::public.payroll_status else'partial'::public.payroll_status end where id=payroll.id;
end$$;
revoke all on function public.update_payroll_payment(uuid,uuid,numeric,date,text)from public;
grant execute on function public.update_payroll_payment(uuid,uuid,numeric,date,text)to authenticated;
