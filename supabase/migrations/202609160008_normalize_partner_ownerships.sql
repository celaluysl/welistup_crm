create or replace function public.ensure_month_partner_ownerships(p_year integer,p_month integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare
  month_start date:=make_date(p_year,p_month,1);
  month_end date:=(make_date(p_year,p_month,1)+interval'1 month'-interval'1 day')::date;
  existing_total numeric;
  partner_count integer;
begin
  if not public.has_permission('month_close.manage') then raise exception'insufficient_permission' using errcode='42501'; end if;
  select coalesce(sum(ownership_percent),0),count(*) into existing_total,partner_count
  from public.partner_ownerships
  where effective_from<=month_end and(effective_to is null or effective_to>=month_start);

  if abs(existing_total-100)<=0.0001 then return false; end if;

  if existing_total>0 then
    with applicable as(
      select id,ownership_percent,row_number()over(order by created_at,id) position,count(*)over() total_count
      from public.partner_ownerships
      where effective_from<=month_end and(effective_to is null or effective_to>=month_start)
    ), normalized as(
      select id,case
        when position=total_count then 100-coalesce(sum(round(ownership_percent*100/existing_total,4))over(rows between unbounded preceding and 1 preceding),0)
        else round(ownership_percent*100/existing_total,4)
      end normalized_percent
      from applicable
    )
    update public.partner_ownerships ownership
    set ownership_percent=normalized.normalized_percent
    from normalized where ownership.id=normalized.id;
    return true;
  end if;

  select count(*) into partner_count from public.profiles where status='active' and employment_type='partner';
  if partner_count=0 then raise exception'no_active_partners'; end if;
  insert into public.partner_ownerships(profile_id,ownership_percent,effective_from,created_by)
  select profile_id,case when position=partner_count then 100-round(100.0/partner_count,4)*(partner_count-1) else round(100.0/partner_count,4) end,month_start,auth.uid()
  from(select id profile_id,row_number()over(order by created_at,id) position from public.profiles where status='active' and employment_type='partner')partners;
  return true;
end$$;

grant execute on function public.ensure_month_partner_ownerships(integer,integer) to authenticated;
