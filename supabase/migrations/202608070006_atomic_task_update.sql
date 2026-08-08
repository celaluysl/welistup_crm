create or replace function public.update_task_with_assignees(
 p_task_id uuid,p_title text,p_description text,p_project_service_id uuid,p_priority public.task_priority,
 p_status public.task_status,p_waiting_reason public.waiting_reason,p_start_date date,p_due_date date,p_assignee_ids uuid[]
)returns void language plpgsql security invoker set search_path='' as $$
declare task_project uuid;
begin
 select project_id into task_project from public.tasks where id=p_task_id for update;
 if task_project is null then raise exception 'task_not_found';end if;
 if not public.can_access_project(task_project)or not public.has_permission('operations.manage')then raise exception 'insufficient_permission' using errcode='42501';end if;
 update public.tasks set title=p_title,description=nullif(p_description,''),project_service_id=p_project_service_id,priority=p_priority,status=p_status,
 waiting_reason=case when p_status='waiting_client'then p_waiting_reason else null end,start_date=p_start_date,due_date=p_due_date,
 completed_at=case when p_status='completed'then coalesce(completed_at,now())else null end,updated_by=auth.uid() where id=p_task_id;
 delete from public.task_assignees where task_id=p_task_id;
 insert into public.task_assignees(task_id,profile_id)select p_task_id,x from unnest(coalesce(p_assignee_ids,array[]::uuid[]))x;
end $$;
grant execute on function public.update_task_with_assignees(uuid,text,text,uuid,public.task_priority,public.task_status,public.waiting_reason,date,date,uuid[])to authenticated;
