create table if not exists public.month_close_account_settlements(
  id uuid primary key default gen_random_uuid(),
  month_close_id uuid not null unique references public.month_closes(id),
  settlement_date date not null,
  movements jsonb not null default'[]'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.month_close_account_settlements enable row level security;
create policy month_close_settlements_read on public.month_close_account_settlements
for select to authenticated using(public.has_permission('month_close.read'));

create or replace function public.settle_accounts_after_month_close()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  inv_collection uuid; uninv_collection uuid; inv_expense uuid; uninv_expense uuid;
  inv_cash uuid; uninv_cash uuid; distribution uuid; actor uuid:=auth.uid();
  inv_collection_balance numeric; uninv_collection_balance numeric;
  inv_expense_balance numeric; uninv_expense_balance numeric;
  inv_cash_balance numeric; uninv_cash_balance numeric;
  inv_target numeric; uninv_target numeric; delta numeric; group_id uuid;
  close_date date; movement_log jsonb:='[]'::jsonb;
begin
  if new.status<>'closed' or old.status='closed' then return new; end if;
  if exists(select 1 from public.month_close_account_settlements where month_close_id=new.id) then return new; end if;
  close_date:=(make_date(new.year,new.month,1)+interval'1 month'-interval'1 day')::date;

  select id into inv_collection from public.accounts where name='Şirket Tahsilat Kasası' and status='active' for update;
  select id into uninv_collection from public.accounts where name='Faturasız Tahsilat Kasası' and status='active' for update;
  select id,opening_balance into inv_expense,inv_target from public.accounts where name='Şirket Gider Kasası' and status='active' for update;
  select id,opening_balance into uninv_expense,uninv_target from public.accounts where name='Faturasız Gider Kasası' and status='active' for update;
  select id into inv_cash from public.accounts where name='Faturalı Nakit Kasa' and status='active' for update;
  select id into uninv_cash from public.accounts where name='Faturasız Nakit Kasa' and status='active' for update;
  if inv_collection is null or uninv_collection is null or inv_expense is null or uninv_expense is null then raise exception'close_accounts_missing'; end if;

  insert into public.accounts(name,account_type,currency,billing_preference,opening_balance,status,notes,created_by)
  values('Ay Kapanış Dağıtım Kasası','bank','TRY','invoiced',0,'active','Kapanışta tahsilat kasalarından devredilen ve ortak dağıtımına ayrılan bakiye.',actor)
  on conflict(name)do update set status='active'
  returning id into distribution;

  if inv_cash is not null then
    select opening_balance+coalesce((select sum(amount)from public.finance_transactions where account_id=inv_cash),0) into inv_cash_balance from public.accounts where id=inv_cash;
    if inv_cash_balance<0 then raise exception'negative_collection_balance'; end if;
    if inv_cash_balance>0 then perform public.transfer_between_accounts(inv_cash,inv_collection,inv_cash_balance,close_date,'Ay kapanışı nakit tahsilat konsolidasyonu'); end if;
  end if;
  if uninv_cash is not null then
    select opening_balance+coalesce((select sum(amount)from public.finance_transactions where account_id=uninv_cash),0) into uninv_cash_balance from public.accounts where id=uninv_cash;
    if uninv_cash_balance<0 then raise exception'negative_collection_balance'; end if;
    if uninv_cash_balance>0 then perform public.transfer_between_accounts(uninv_cash,uninv_collection,uninv_cash_balance,close_date,'Ay kapanışı nakit tahsilat konsolidasyonu'); end if;
  end if;

  select opening_balance+coalesce((select sum(amount)from public.finance_transactions where account_id=inv_expense),0) into inv_expense_balance from public.accounts where id=inv_expense;
  delta:=coalesce(inv_target,0)-inv_expense_balance;
  if delta>0 then perform public.transfer_between_accounts(inv_collection,inv_expense,delta,close_date,'Ay kapanışı · Faturalı gider kasasını hedefe tamamlama');
  elsif delta<0 then perform public.transfer_between_accounts(inv_expense,inv_collection,-delta,close_date,'Ay kapanışı · Faturalı gider kasası fazlasını iade'); end if;
  movement_log:=movement_log||jsonb_build_object('account','Şirket Gider Kasası','target',inv_target,'adjustment',delta);

  select opening_balance+coalesce((select sum(amount)from public.finance_transactions where account_id=uninv_expense),0) into uninv_expense_balance from public.accounts where id=uninv_expense;
  delta:=coalesce(uninv_target,0)-uninv_expense_balance;
  if delta>0 then perform public.transfer_between_accounts(uninv_collection,uninv_expense,delta,close_date,'Ay kapanışı · Faturasız gider kasasını hedefe tamamlama');
  elsif delta<0 then perform public.transfer_between_accounts(uninv_expense,uninv_collection,-delta,close_date,'Ay kapanışı · Faturasız gider kasası fazlasını iade'); end if;
  movement_log:=movement_log||jsonb_build_object('account','Faturasız Gider Kasası','target',uninv_target,'adjustment',delta);

  select opening_balance+coalesce((select sum(amount)from public.finance_transactions where account_id=inv_collection),0) into inv_collection_balance from public.accounts where id=inv_collection;
  select opening_balance+coalesce((select sum(amount)from public.finance_transactions where account_id=uninv_collection),0) into uninv_collection_balance from public.accounts where id=uninv_collection;
  if inv_collection_balance<0 or uninv_collection_balance<0 then raise exception'insufficient_close_funds'; end if;
  if inv_collection_balance>0 then perform public.transfer_between_accounts(inv_collection,distribution,inv_collection_balance,close_date,'Ay kapanışı · Faturalı tahsilat bakiyesi devri'); end if;
  if uninv_collection_balance>0 then perform public.transfer_between_accounts(uninv_collection,distribution,uninv_collection_balance,close_date,'Ay kapanışı · Faturasız tahsilat bakiyesi devri'); end if;
  movement_log:=movement_log||jsonb_build_object('account','Tahsilat kasaları','invoiced_remainder',inv_collection_balance,'uninvoiced_remainder',uninv_collection_balance,'destination','Ay Kapanış Dağıtım Kasası');

  insert into public.month_close_account_settlements(month_close_id,settlement_date,movements,created_by)
  values(new.id,close_date,movement_log,actor);
  return new;
end$$;

drop trigger if exists settle_accounts_after_month_close on public.month_closes;
create trigger settle_accounts_after_month_close
after update of status on public.month_closes
for each row execute function public.settle_accounts_after_month_close();
