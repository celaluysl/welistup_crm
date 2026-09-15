create table public.manual_incomes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id),
  amount numeric(18,2) not null check (amount > 0),
  currency public.currency_code not null default 'TRY',
  billing_preference public.billing_preference not null,
  payment_date date not null,
  notes text not null,
  transaction_id uuid not null unique references public.finance_transactions(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index manual_incomes_payment_date_idx on public.manual_incomes(payment_date);
alter table public.manual_incomes enable row level security;
create policy manual_incomes_read on public.manual_incomes for select to authenticated using(public.has_permission('finance.read'));
create policy manual_incomes_manage on public.manual_incomes for all to authenticated using(public.has_permission('finance.manage')) with check(public.has_permission('finance.manage'));

create or replace function public.record_manual_income(p_account_id uuid,p_amount numeric,p_billing_preference public.billing_preference,p_payment_date date,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare account_record public.accounts%rowtype;tx_id uuid;income_id uuid;
begin
  if not(public.has_permission('finance.manage')and public.has_permission('accounts.manage'))then raise exception'insufficient_permission'using errcode='42501';end if;
  if p_amount<=0 or nullif(trim(p_notes),'')is null then raise exception'invalid_income';end if;
  if exists(select 1 from public.month_closes where year=extract(year from p_payment_date)::integer and month=extract(month from p_payment_date)::integer and status='closed')then raise exception'period_closed';end if;
  select*into account_record from public.accounts where id=p_account_id and status='active';
  if not found or account_record.currency<>'TRY' then raise exception'currency_or_account_missing';end if;
  if account_record.billing_preference<>p_billing_preference then raise exception'billing_preference_mismatch';end if;
  insert into public.finance_transactions(account_id,transaction_date,transaction_type,amount,currency,category,description,created_by)
  values(p_account_id,p_payment_date,'income',p_amount,'TRY','Ekstra gelir',trim(p_notes),auth.uid())returning id into tx_id;
  insert into public.manual_incomes(account_id,amount,currency,billing_preference,payment_date,notes,transaction_id,created_by)
  values(p_account_id,p_amount,'TRY',p_billing_preference,p_payment_date,trim(p_notes),tx_id,auth.uid())returning id into income_id;
  return income_id;
end$$;

create or replace function public.cancel_manual_income(p_income_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare income public.manual_incomes%rowtype;
begin
  if not(public.has_permission('finance.manage')and public.has_permission('accounts.manage'))then raise exception'insufficient_permission'using errcode='42501';end if;
  select*into income from public.manual_incomes where id=p_income_id for update;if not found then raise exception'income_not_found';end if;
  if exists(select 1 from public.month_closes where year=extract(year from income.payment_date)::integer and month=extract(month from income.payment_date)::integer and status='closed')then raise exception'period_closed';end if;
  delete from public.manual_incomes where id=income.id;
  delete from public.finance_transactions where id=income.transaction_id;
end$$;

grant execute on function public.record_manual_income(uuid,numeric,public.billing_preference,date,text)to authenticated;
grant execute on function public.cancel_manual_income(uuid)to authenticated;
