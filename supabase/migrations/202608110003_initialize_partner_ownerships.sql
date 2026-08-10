-- Initialize equal ownership for the three existing active partners only when
-- no historical ownership record has been created yet.
do $$
declare
  partner_count integer;
begin
  select count(*)
  into partner_count
  from public.profiles
  where status = 'active'
    and employment_type = 'partner';

  if partner_count = 3
    and not exists (select 1 from public.partner_ownerships)
  then
    insert into public.partner_ownerships (
      profile_id,
      ownership_percent,
      effective_from,
      effective_to,
      created_by
    )
    select
      id,
      100.0 / partner_count,
      date '2026-01-01',
      null,
      id
    from public.profiles
    where status = 'active'
      and employment_type = 'partner';
  end if;
end
$$;
