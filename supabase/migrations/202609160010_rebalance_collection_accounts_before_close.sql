create or replace function public.rebalance_collection_accounts_before_close()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  inv_collection uuid; uninv_collection uuid; inv_expense uuid; uninv_expense uuid;
  inv_collection_balance numeric; uninv_collection_balance numeric;
  inv_expense_balance numeric; uninv_expense_balance numeric;
  inv_target numeric; uninv_target numeric; inv_need numeric; uninv_need numeric;
  transfer_amount numeric; close_date date;
begin
  if new.status<>'closed' or old.status='closed' then return new; end if;
  close_date:=(make_date(new.year,new.month,1)+interval'1 month'-interval'1 day')::date;
  select id into inv_collection from public.accounts where name='Şirket Tahsilat Kasası' and status='active' for update;
  select id into uninv_collection from public.accounts where name='Faturasız Tahsilat Kasası' and status='active' for update;
  select id,opening_balance into inv_expense,inv_target from public.accounts where name='Şirket Gider Kasası' and status='active' for update;
  select id,opening_balance into uninv_expense,uninv_target from public.accounts where name='Faturasız Gider Kasası' and status='active' for update;
  if inv_collection is null or uninv_collection is null or inv_expense is null or uninv_expense is null then return new; end if;

  select opening_balance+coalesce((select sum(amount)from public.finance_transactions where account_id=inv_collection and transaction_date>=date'2026-08-01'),0) into inv_collection_balance from public.accounts where id=inv_collection;
  select opening_balance+coalesce((select sum(amount)from public.finance_transactions where account_id=uninv_collection and transaction_date>=date'2026-08-01'),0) into uninv_collection_balance from public.accounts where id=uninv_collection;
  select opening_balance+coalesce((select sum(amount)from public.finance_transactions where account_id=inv_expense and transaction_date>=date'2026-08-01'),0) into inv_expense_balance from public.accounts where id=inv_expense;
  select opening_balance+coalesce((select sum(amount)from public.finance_transactions where account_id=uninv_expense and transaction_date>=date'2026-08-01'),0) into uninv_expense_balance from public.accounts where id=uninv_expense;
  inv_need:=greatest(coalesce(inv_target,0)-inv_expense_balance,0);
  uninv_need:=greatest(coalesce(uninv_target,0)-uninv_expense_balance,0);

  if inv_collection_balance<inv_need and uninv_collection_balance>uninv_need then
    transfer_amount:=least(inv_need-inv_collection_balance,uninv_collection_balance-uninv_need);
    if transfer_amount>0 then perform public.transfer_between_accounts(uninv_collection,inv_collection,transfer_amount,close_date,'Ay kapanışı · Tahsilat kasaları arası faturalı gider dengelemesi'); end if;
  elsif uninv_collection_balance<uninv_need and inv_collection_balance>inv_need then
    transfer_amount:=least(uninv_need-uninv_collection_balance,inv_collection_balance-inv_need);
    if transfer_amount>0 then perform public.transfer_between_accounts(inv_collection,uninv_collection,transfer_amount,close_date,'Ay kapanışı · Tahsilat kasaları arası faturasız gider dengelemesi'); end if;
  end if;
  return new;
end$$;

drop trigger if exists rebalance_collection_accounts_before_close on public.month_closes;
create trigger rebalance_collection_accounts_before_close
before update of status on public.month_closes
for each row execute function public.rebalance_collection_accounts_before_close();
