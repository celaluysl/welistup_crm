alter table public.profiles
  add column if not exists base_salary numeric(18,2) not null default 0 check (base_salary >= 0),
  add column if not exists salary_currency public.currency_code not null default 'TRY';

with latest_salary as (
  select distinct on (profile_id)
    profile_id, base_salary, currency
  from public.salary_configs
  order by profile_id, effective_from desc, created_at desc
)
update public.profiles p
set base_salary = s.base_salary,
    salary_currency = s.currency
from latest_salary s
where p.id = s.profile_id;

create or replace function public.generate_payroll_periods(p_year integer,p_month integer)
returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare
  p record;
  affected_count integer := 0;
begin
  if not public.has_permission('payroll.manage') then
    raise exception 'insufficient_permission' using errcode='42501';
  end if;

  for p in
    select id, employment_type, base_salary, salary_currency
    from public.profiles
    where status='active'
      and employment_type in ('employee','partner')
      and base_salary > 0
  loop
    insert into public.payroll_periods(
      profile_id,year,month,employment_type,base_salary,currency,created_by
    ) values (
      p.id,p_year,p_month,p.employment_type,p.base_salary,p.salary_currency,auth.uid()
    )
    on conflict(profile_id,year,month) do update
      set employment_type=excluded.employment_type,
          base_salary=excluded.base_salary,
          currency=excluded.currency
      where not exists (
        select 1 from public.payroll_payments pp
        where pp.payroll_period_id=public.payroll_periods.id
      );
    if found then affected_count := affected_count + 1; end if;
  end loop;
  return affected_count;
end
$$;

-- Daha önce ayrı maaş formundan girilen mevcut tanımı bu ayın kaydına dönüştür.
insert into public.payroll_periods(
  profile_id,year,month,employment_type,base_salary,currency,created_by
)
select
  p.id,
  extract(year from current_date)::integer,
  extract(month from current_date)::integer,
  p.employment_type,
  p.base_salary,
  p.salary_currency,
  coalesce(sc.created_by,p.id)
from public.profiles p
left join lateral (
  select created_by from public.salary_configs s
  where s.profile_id=p.id
  order by effective_from desc,created_at desc limit 1
) sc on true
where p.status='active'
  and p.employment_type in ('employee','partner')
  and p.base_salary > 0
on conflict(profile_id,year,month) do update
set employment_type=excluded.employment_type,
    base_salary=excluded.base_salary,
    currency=excluded.currency
where not exists (
  select 1 from public.payroll_payments pp
  where pp.payroll_period_id=public.payroll_periods.id
);
