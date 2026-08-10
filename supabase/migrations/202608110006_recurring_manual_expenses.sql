create table public.manual_expense_templates(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  net_amount numeric(18,2) not null check(net_amount>=0),
  vat_rate numeric(5,2) not null default 0 check(vat_rate between 0 and 100),
  currency public.currency_code not null default 'TRY',
  billing_preference public.billing_preference not null,
  due_day integer check(due_day between 1 and 31),
  starts_on date not null,
  ends_on date,
  next_run_on date not null,
  notes text,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_on is null or ends_on>=starts_on)
);

alter table public.manual_expenses
  add column template_id uuid references public.manual_expense_templates(id);

create unique index manual_expenses_template_period_unique
  on public.manual_expenses(template_id,year,month)
  where template_id is not null;
create index manual_expense_templates_run_idx
  on public.manual_expense_templates(next_run_on)
  where is_active;
create trigger set_updated_at before update on public.manual_expense_templates
  for each row execute function public.set_updated_at();

alter table public.manual_expense_templates enable row level security;
create policy manual_expense_templates_read on public.manual_expense_templates
  for select to authenticated using(public.has_permission('finance.read'));
create policy manual_expense_templates_manage on public.manual_expense_templates
  for all to authenticated using(public.has_permission('finance.manage'))
  with check(public.has_permission('finance.manage'));

create or replace function public.generate_recurring_manual_expenses(p_until date default(current_date+interval'60 days')::date)
returns integer language plpgsql security definer set search_path=''as $$
declare t record;run_date date;vat_amount numeric;created_count integer:=0;
begin
  for t in
    select*from public.manual_expense_templates
    where is_active and next_run_on<=p_until
    for update skip locked
  loop
    run_date:=t.next_run_on;
    while run_date<=p_until and(t.ends_on is null or run_date<=t.ends_on)loop
      vat_amount:=round(t.net_amount*case when t.billing_preference='invoiced'then t.vat_rate else 0 end/100,2);
      insert into public.manual_expenses(template_id,name,category,year,month,net_amount,vat_rate,vat_amount,amount,currency,billing_preference,due_date,notes,created_by)
      values(t.id,t.name,t.category,extract(year from run_date)::integer,extract(month from run_date)::integer,t.net_amount,case when t.billing_preference='invoiced'then t.vat_rate else 0 end,vat_amount,t.net_amount+vat_amount,t.currency,t.billing_preference,
        case when t.due_day is null then null else make_date(extract(year from run_date)::integer,extract(month from run_date)::integer,least(t.due_day,extract(day from(date_trunc('month',run_date)+interval'1 month-1 day'))::integer))end,
        t.notes,t.created_by)
      on conflict(template_id,year,month)where template_id is not null do nothing;
      if found then created_count:=created_count+1;end if;
      run_date:=(run_date+interval'1 month')::date;
    end loop;
    update public.manual_expense_templates set next_run_on=run_date,
      is_active=not(ends_on is not null and run_date>ends_on)where id=t.id;
  end loop;
  return created_count;
end$$;

revoke all on function public.generate_recurring_manual_expenses(date)from public;
grant execute on function public.generate_recurring_manual_expenses(date)to authenticated;

do $$begin
  if exists(select 1 from cron.job where jobname='welistup-daily-recurring-expenses')then
    perform cron.unschedule('welistup-daily-recurring-expenses');
  end if;
  perform cron.schedule('welistup-daily-recurring-expenses','45 0 * * *','select public.generate_recurring_manual_expenses();');
end$$;
