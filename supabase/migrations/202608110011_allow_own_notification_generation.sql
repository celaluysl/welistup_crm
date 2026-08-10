drop policy if exists notifications_insert_own on public.notifications;
create policy notifications_insert_own
  on public.notifications
  for insert
  to authenticated
  with check (recipient_id = (select auth.uid()));

-- Fonksiyon çağıran kullanıcının RLS bağlamında çalışmaya devam eder.
-- Böylece başka bir kullanıcı adına bildirim üretilemez.
create or replace function public.refresh_my_notifications()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_count integer := 0;
  inserted_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  insert into public.notifications(recipient_id,notification_type,title,body,href,source_key)
  select current_user_id,
    case when t.due_date < current_date then 'task_overdue'::public.notification_type else 'task_due'::public.notification_type end,
    case when t.due_date < current_date then 'Görev gecikti' else 'Görev son tarihi yaklaşıyor' end,
    t.title || ' · ' || coalesce(p.name,''),
    '/projects/' || t.project_id || '/tasks/' || t.id,
    'task:' || t.id || ':' || t.due_date
  from public.tasks t
  join public.task_assignees a on a.task_id=t.id
  join public.projects p on p.id=t.project_id
  where a.profile_id=current_user_id and t.status<>'completed' and t.due_date<=current_date+2
  on conflict(recipient_id,source_key) do nothing;
  get diagnostics created_count=row_count;

  if public.has_permission('collections.read') or public.has_permission('finance.read') then
    insert into public.notifications(recipient_id,notification_type,title,body,href,source_key)
    select current_user_id,'receivable_overdue', 'Gecikmiş müşteri ödemesi',
      c.company_name || ' · ' || r.total_amount || ' ' || r.currency,
      '/collections/' || r.id, 'receivable:' || r.id || ':' || r.due_date
    from public.receivables r join public.clients c on c.id=r.client_id
    where r.status<>'paid' and r.due_date<current_date
    on conflict(recipient_id,source_key) do nothing;
    get diagnostics inserted_count=row_count;
    created_count:=created_count+inserted_count;
  end if;

  if public.has_permission('vendors.read') then
    insert into public.notifications(recipient_id,notification_type,title,body,href,source_key)
    select current_user_id,'vendor_payment_due','Tedarikçi ödemesi yaklaşıyor',
      v.name || ' · ' || a.amount || ' ' || a.currency,
      '/vendors/' || v.id, 'vendor-accrual:' || a.id || ':' || a.due_date
    from public.vendor_accruals a join public.vendors v on v.id=a.vendor_id
    where a.status in('pending','partial') and a.due_date<=current_date+3
    on conflict(recipient_id,source_key) do nothing;
    get diagnostics inserted_count=row_count;
    created_count:=created_count+inserted_count;
  end if;

  if public.has_permission('sales.read') then
    insert into public.notifications(recipient_id,notification_type,title,body,href,source_key)
    select current_user_id,'offer_expiring','Teklif süresi doluyor',
      o.offer_number || ' · ' || coalesce(c.company_name,l.company_name,''),
      '/offers/' || o.id, 'offer:' || o.id || ':' || o.valid_until
    from public.offers o
    left join public.clients c on c.id=o.client_id
    left join public.leads l on l.id=o.lead_id
    where o.status in('ready','sent','revising') and o.valid_until<=current_date+3
    on conflict(recipient_id,source_key) do nothing;
    get diagnostics inserted_count=row_count;
    created_count:=created_count+inserted_count;
  end if;

  return created_count;
end;
$$;

revoke all on function public.refresh_my_notifications() from public;
grant execute on function public.refresh_my_notifications() to authenticated;
