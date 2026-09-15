create or replace function public.generate_service_year_periods(p_year integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_month integer;
  created_count integer := 0;
begin
  if p_year < 2000 or p_year > 2200 then
    raise exception 'invalid_year';
  end if;

  for target_month in 1..12 loop
    created_count := created_count + public.generate_service_periods(p_year, target_month);
  end loop;

  return created_count;
end;
$$;

revoke all on function public.generate_service_year_periods(integer) from public;
grant execute on function public.generate_service_year_periods(integer) to authenticated;
