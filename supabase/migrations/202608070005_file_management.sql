create type public.file_category as enum('contract','offer','proforma','invoice','receipt','report','task_attachment','client_document','other');
create table public.files(
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),entity_type text not null,entity_id uuid not null,
 category public.file_category not null default 'other',bucket_id text not null default 'agency-files',storage_path text not null unique,original_name text not null,
 mime_type text,size_bytes bigint check(size_bytes is null or size_bytes>=0),uploaded_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create index files_project_idx on public.files(project_id,created_at desc);create index files_entity_idx on public.files(entity_type,entity_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('agency-files','agency-files',false,26214400,array['application/pdf','image/png','image/jpeg','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) on conflict(id)do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into public.permissions(key,name,module)values('files.read','Proje dosyalarını görüntüle','operations'),('files.manage','Proje dosyalarını yönet','operations');
insert into public.role_permissions(role_id,permission_id)select r.id,p.id from public.roles r cross join public.permissions p where r.slug='super-admin'and p.key in('files.read','files.manage');
insert into public.role_permissions(role_id,permission_id)select r.id,p.id from public.roles r join public.permissions p on p.key in('files.read','files.manage')where r.slug in('partner','employee');
alter table public.files enable row level security;
create policy files_read on public.files for select to authenticated using(public.can_access_project(project_id)and public.has_permission('files.read'));
create policy files_insert on public.files for insert to authenticated with check(public.can_access_project(project_id)and public.has_permission('files.manage')and uploaded_by=auth.uid());
create policy project_storage_read on storage.objects for select to authenticated using(bucket_id='agency-files'and public.has_permission('files.read')and public.can_access_project(((storage.foldername(name))[1])::uuid));
create policy project_storage_insert on storage.objects for insert to authenticated with check(bucket_id='agency-files'and public.has_permission('files.manage')and public.can_access_project(((storage.foldername(name))[1])::uuid));
