-- A project can be stopped after its monthly vendor accrual was generated.
-- Keep paid history intact, but cancel unpaid accruals from the effective stop
-- period onward. When the assignment is restarted, eligible cancelled accruals
-- can become pending again.
create or replace function public.reconcile_vendor_accruals_after_assignment_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  effective_end date;
begin
  effective_end := coalesce(new.end_date, current_date);

  if new.status <> 'active' then
    update public.vendor_accruals a
    set status = 'cancelled'::public.accrual_status,
        notes = case
          when nullif(trim(a.notes), '') is null then 'Proje/tedarikçi ataması durdurulduğu için iptal edildi.'
          else a.notes || E'\nProje/tedarikçi ataması durdurulduğu için iptal edildi.'
        end
    where a.vendor_assignment_id = new.id
      and a.status <> 'cancelled'
      and make_date(a.year, a.month, 1) >= effective_end
      and not exists (
        select 1
        from public.vendor_payments vp
        where vp.vendor_accrual_id = a.id
      );
  elsif old.status <> 'active' then
    update public.vendor_accruals a
    set status = 'pending'::public.accrual_status,
        notes = nullif(
          trim(replace(coalesce(a.notes, ''), 'Proje/tedarikçi ataması durdurulduğu için iptal edildi.', '')),
          ''
        )
    where a.vendor_assignment_id = new.id
      and a.status = 'cancelled'
      and make_date(a.year, a.month, 1) >= date_trunc('month', new.start_date)::date
      and (new.end_date is null or make_date(a.year, a.month, 1) < new.end_date)
      and not exists (
        select 1
        from public.vendor_payments vp
        where vp.vendor_accrual_id = a.id
      );
  end if;

  update public.service_periods sp
  set cost_amount = coalesce((
    select sum(a.amount)
    from public.vendor_accruals a
    where a.project_service_id = sp.project_service_id
      and a.year = sp.year
      and a.month = sp.month
      and a.status <> 'cancelled'
  ), 0)
  where sp.project_service_id = new.project_service_id;

  return new;
end;
$$;

drop trigger if exists reconcile_vendor_accruals_after_assignment_change
on public.vendor_assignments;

create trigger reconcile_vendor_accruals_after_assignment_change
after update of status, end_date on public.vendor_assignments
for each row
when (old.status is distinct from new.status or old.end_date is distinct from new.end_date)
execute function public.reconcile_vendor_accruals_after_assignment_change();

-- Repair already-stopped assignments, including records generated before this
-- trigger existed. Accruals with any payment/settlement remain untouched.
update public.vendor_accruals a
set status = 'cancelled'::public.accrual_status,
    notes = case
      when nullif(trim(a.notes), '') is null then 'Proje/tedarikçi ataması durdurulduğu için iptal edildi.'
      else a.notes || E'\nProje/tedarikçi ataması durdurulduğu için iptal edildi.'
    end
from public.vendor_assignments va
where a.vendor_assignment_id = va.id
  and va.status <> 'active'
  and a.status <> 'cancelled'
  and make_date(a.year, a.month, 1) >= coalesce(va.end_date, current_date)
  and not exists (
    select 1
    from public.vendor_payments vp
    where vp.vendor_accrual_id = a.id
  );

update public.service_periods sp
set cost_amount = coalesce((
  select sum(a.amount)
  from public.vendor_accruals a
  where a.project_service_id = sp.project_service_id
    and a.year = sp.year
    and a.month = sp.month
    and a.status <> 'cancelled'
), 0);
