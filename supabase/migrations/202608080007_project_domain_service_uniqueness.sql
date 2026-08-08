-- A domain may have separate projects for separate services (for example SEO
-- and Google Ads). Only the same domain + same active service is prohibited.
drop index if exists public.projects_active_domain_unique;

create or replace function public.enforce_project_domain_service_unique()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  project_domain text;
  project_status public.record_status;
begin
  select lower(trim(domain)), status
    into project_domain, project_status
  from public.projects
  where id = new.project_id;

  if project_domain is null or project_status = 'archived' or new.status = 'archived' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(project_domain || ':' || new.service_id::text, 0));

  if exists (
    select 1
    from public.project_services existing_service
    join public.projects existing_project on existing_project.id = existing_service.project_id
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

drop trigger if exists project_domain_service_unique_on_service on public.project_services;
create trigger project_domain_service_unique_on_service
before insert or update of project_id, service_id, status
on public.project_services
for each row execute function public.enforce_project_domain_service_unique();

create or replace function public.enforce_project_domain_service_unique_on_project()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  service_row record;
  normalized_domain text := lower(trim(new.domain));
begin
  if normalized_domain is null or new.status = 'archived' then
    return new;
  end if;

  for service_row in
    select id, service_id
    from public.project_services
    where project_id = new.id and status <> 'archived'
  loop
    perform pg_advisory_xact_lock(hashtextextended(normalized_domain || ':' || service_row.service_id::text, 0));

    if exists (
      select 1
      from public.project_services existing_service
      join public.projects existing_project on existing_project.id = existing_service.project_id
      where existing_service.project_id <> new.id
        and existing_service.service_id = service_row.service_id
        and existing_service.status <> 'archived'
        and existing_project.status <> 'archived'
        and lower(trim(existing_project.domain)) = normalized_domain
    ) then
      raise exception 'project_domain_service_exists' using errcode = '23505';
    end if;
  end loop;

  return new;
end $$;

drop trigger if exists project_domain_service_unique_on_project on public.projects;
create trigger project_domain_service_unique_on_project
before update of domain, status
on public.projects
for each row execute function public.enforce_project_domain_service_unique_on_project();

