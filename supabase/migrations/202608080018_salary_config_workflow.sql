create or replace function public.set_salary_config(
  p_profile_id uuid,
  p_base_salary numeric,
  p_currency public.currency_code,
  p_effective_from date,
  p_notes text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  config_id uuid;
  next_start date;
begin
  if not public.has_permission('payroll.manage') then
    raise exception 'insufficient_permission' using errcode = '42501';
  end if;
  if p_base_salary < 0 then raise exception 'invalid_salary'; end if;
  if not exists(select 1 from public.profiles where id=p_profile_id and status='active' and employment_type in('employee','partner')) then
    raise exception 'profile_not_eligible_for_salary';
  end if;

  select min(effective_from) into next_start
  from public.salary_configs
  where profile_id=p_profile_id and effective_from>p_effective_from;

  update public.salary_configs
  set effective_to=p_effective_from-1
  where profile_id=p_profile_id
    and effective_from<p_effective_from
    and (effective_to is null or effective_to>=p_effective_from);

  update public.salary_configs
  set base_salary=p_base_salary,
      currency=p_currency,
      effective_to=case when next_start is null then null else next_start-1 end,
      notes=p_notes
  where profile_id=p_profile_id and effective_from=p_effective_from
  returning id into config_id;
  if config_id is null then
    insert into public.salary_configs(profile_id,base_salary,currency,effective_from,effective_to,notes,created_by)
    values(p_profile_id,p_base_salary,p_currency,p_effective_from,case when next_start is null then null else next_start-1 end,p_notes,auth.uid())
    returning id into config_id;
  end if;

  update public.payroll_periods
  set base_salary=p_base_salary,currency=p_currency
  where profile_id=p_profile_id
    and year=extract(year from p_effective_from)::integer
    and month=extract(month from p_effective_from)::integer
    and not exists(select 1 from public.payroll_payments where payroll_period_id=public.payroll_periods.id);
  return config_id;
end
$$;

revoke all on function public.set_salary_config(uuid,numeric,public.currency_code,date,text) from public;
grant execute on function public.set_salary_config(uuid,numeric,public.currency_code,date,text) to authenticated;
