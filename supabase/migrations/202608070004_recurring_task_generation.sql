create or replace function public.generate_due_recurring_tasks(p_project_id uuid default null,p_run_date date default current_date)
returns integer language plpgsql security invoker set search_path='' as $$
declare template record; generated_count integer:=0; next_date date;
begin
 if not public.has_permission('operations.manage') then raise exception 'insufficient_permission' using errcode='42501';end if;
 for template in select * from public.recurring_task_templates where is_active and next_run_on<=p_run_date and(p_project_id is null or project_id=p_project_id) and(ends_on is null or next_run_on<=ends_on) for update skip locked loop
   insert into public.tasks(project_id,project_service_id,title,description,priority,status,start_date,due_date,created_by,updated_by) values(template.project_id,template.project_service_id,template.title,template.description,template.priority,'todo',template.next_run_on,template.next_run_on,auth.uid(),auth.uid());
   next_date:=case template.recurrence when 'daily' then template.next_run_on+template.interval_value when 'weekly' then template.next_run_on+(template.interval_value*7) when 'monthly' then(template.next_run_on+(template.interval_value||' months')::interval)::date else template.next_run_on+template.interval_value end;
   update public.recurring_task_templates set next_run_on=next_date,is_active=not(ends_on is not null and next_date>ends_on) where id=template.id;
   generated_count:=generated_count+1;
 end loop;
 return generated_count;
end $$;
grant execute on function public.generate_due_recurring_tasks(uuid,date) to authenticated;
