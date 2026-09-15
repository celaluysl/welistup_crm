-- Project status and generic record status are separate enum types.
-- The domain/service uniqueness trigger must not cast on_hold/completed
-- project states to record_status.
create or replace function public.enforce_project_domain_service_unique()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  project_domain text;
  project_state public.project_status;
begin
  select lower(trim(domain)), status
    into project_domain, project_state
  from public.projects
  where id = new.project_id;

  if project_domain is null or project_state = 'archived' or new.status = 'archived' then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(project_domain || ':' || new.service_id::text, 0)
  );

  if exists (
    select 1
    from public.project_services existing_service
    join public.projects existing_project
      on existing_project.id = existing_service.project_id
    where existing_service.id <> new.id
      and existing_service.service_id = new.service_id
      and existing_service.status <> 'archived'
      and existing_project.status <> 'archived'
      and lower(trim(existing_project.domain)) = project_domain
  ) then
    raise exception 'project_domain_service_exists' using errcode = '23505';
  end if;

  return new;
end $$;
