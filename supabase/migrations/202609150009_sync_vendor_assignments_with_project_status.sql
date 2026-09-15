-- Project status is the source of truth for vendor assignments. This protects
-- against partially saved lifecycle changes and also repairs older records.
create or replace function public.sync_vendor_assignments_with_project_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.vendor_assignments va
  set status = case
        when new.status = 'active' then 'active'::public.record_status
        else 'inactive'::public.record_status
      end,
      end_date = case
        when new.status = 'active' then null
        else coalesce(new.end_date, current_date)
      end
  from public.project_services ps
  where ps.id = va.project_service_id
    and ps.project_id = new.id
    and (
      va.status is distinct from case
        when new.status = 'active' then 'active'::public.record_status
        else 'inactive'::public.record_status
      end
      or va.end_date is distinct from case
        when new.status = 'active' then null
        else coalesce(new.end_date, current_date)
      end
    );

  return new;
end;
$$;

drop trigger if exists sync_vendor_assignments_with_project_status
on public.projects;

create trigger sync_vendor_assignments_with_project_status
after update of status, end_date on public.projects
for each row
when (old.status is distinct from new.status or old.end_date is distinct from new.end_date)
execute function public.sync_vendor_assignments_with_project_status();

-- Repair the specifically identified legacy Protek record. Updating the
-- assignment fires the accrual reconciliation trigger from the previous
-- migration; unpaid accruals from the stop period onward are cancelled.
update public.vendor_assignments va
set status = 'inactive'::public.record_status,
    end_date = coalesce(p.end_date, current_date)
from public.project_services ps
join public.projects p on p.id = ps.project_id
where ps.id = va.project_service_id
  and lower(p.name) = 'protekzaman.com'
  and p.status <> 'active'
  and (
    va.status <> 'inactive'::public.record_status
    or va.end_date is distinct from coalesce(p.end_date, current_date)
  );
