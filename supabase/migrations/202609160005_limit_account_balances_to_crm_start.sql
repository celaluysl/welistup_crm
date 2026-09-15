-- Opening balances are the agreed balances at the CRM cut-over. Transactions
-- imported or generated for earlier service periods must not alter live cash.
create or replace function public.account_balances()
returns table(account_id uuid,balance numeric)
language sql stable security invoker set search_path='' as $$
  select
    account.id,
    account.opening_balance+coalesce(sum(transaction.amount) filter(
      where transaction.transaction_date>=date'2026-08-01'
    ),0)
  from public.accounts account
  left join public.finance_transactions transaction on transaction.account_id=account.id
  where public.has_permission('accounts.read')
  group by account.id,account.opening_balance;
$$;

grant execute on function public.account_balances() to authenticated;
