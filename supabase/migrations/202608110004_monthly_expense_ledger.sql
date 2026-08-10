create table public.manual_expenses(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  year integer not null check(year between 2000 and 2200),
  month integer not null check(month between 1 and 12),
  net_amount numeric(18,2) not null check(net_amount>=0),
  vat_rate numeric(5,2) not null default 0 check(vat_rate between 0 and 100),
  vat_amount numeric(18,2) not null default 0 check(vat_amount>=0),
  amount numeric(18,2) not null check(amount>=0),
  currency public.currency_code not null default 'TRY',
  billing_preference public.billing_preference not null default 'invoiced',
  due_date date,
  status public.accrual_status not null default 'pending',
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manual_expense_payments(
  id uuid primary key default gen_random_uuid(),
  manual_expense_id uuid not null references public.manual_expenses(id),
  account_id uuid not null references public.accounts(id),
  amount numeric(18,2) not null check(amount>0),
  currency public.currency_code not null,
  payment_date date not null,
  transaction_id uuid unique references public.finance_transactions(id),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index manual_expenses_period_idx on public.manual_expenses(year,month,billing_preference,status);
create index manual_expense_payments_expense_idx on public.manual_expense_payments(manual_expense_id,payment_date);
create trigger set_updated_at before update on public.manual_expenses for each row execute function public.set_updated_at();

alter table public.manual_expenses enable row level security;
alter table public.manual_expense_payments enable row level security;
create policy manual_expenses_read on public.manual_expenses for select to authenticated using(public.has_permission('finance.read'));
create policy manual_expenses_manage on public.manual_expenses for all to authenticated using(public.has_permission('finance.manage'))with check(public.has_permission('finance.manage'));
create policy manual_expense_payments_read on public.manual_expense_payments for select to authenticated using(public.has_permission('finance.read'));
create policy manual_expense_payments_insert on public.manual_expense_payments for insert to authenticated with check(public.has_permission('finance.manage')and created_by=auth.uid());

create or replace function public.pay_manual_expense(p_expense_id uuid,p_account_id uuid,p_amount numeric,p_payment_date date,p_notes text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare e public.manual_expenses%rowtype;account_currency public.currency_code;account_billing public.billing_preference;paid numeric;tx_id uuid;payment_id uuid;
begin
  if not(public.has_permission('finance.manage')and public.has_permission('accounts.manage'))then raise exception'insufficient_permission'using errcode='42501';end if;
  select*into e from public.manual_expenses where id=p_expense_id for update;
  if not found then raise exception'expense_not_found';end if;
  select currency,billing_preference into account_currency,account_billing from public.accounts where id=p_account_id and status='active';
  if account_currency is null or account_currency<>e.currency then raise exception'currency_mismatch_or_account_missing';end if;
  if account_billing<>e.billing_preference then raise exception'billing_preference_mismatch';end if;
  select coalesce(sum(amount),0)into paid from public.manual_expense_payments where manual_expense_id=e.id;
  if p_amount<=0 or paid+p_amount>e.amount then raise exception'invalid_payment_amount';end if;
  insert into public.finance_transactions(account_id,transaction_date,transaction_type,amount,currency,category,description,created_by)
  values(p_account_id,p_payment_date,'expense',-p_amount,e.currency,e.category,coalesce(nullif(trim(p_notes),''),e.name),auth.uid())returning id into tx_id;
  insert into public.manual_expense_payments(manual_expense_id,account_id,amount,currency,payment_date,transaction_id,notes,created_by)
  values(e.id,p_account_id,p_amount,e.currency,p_payment_date,tx_id,p_notes,auth.uid())returning id into payment_id;
  paid:=paid+p_amount;
  update public.manual_expenses set status=case when paid>=amount then'paid'::public.accrual_status else'partial'::public.accrual_status end where id=e.id;
  return payment_id;
end$$;

grant execute on function public.pay_manual_expense(uuid,uuid,numeric,date,text)to authenticated;
