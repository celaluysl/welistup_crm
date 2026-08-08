create or replace function public.convert_lead_to_client(p_lead_id uuid,p_client_type public.client_type default'direct')returns uuid language plpgsql security invoker set search_path=''as $$
declare source public.leads%rowtype;new_client_id uuid;
begin
 if not public.has_permission('sales.manage')or not public.has_permission('clients.manage')then raise exception'insufficient_permission'using errcode='42501';end if;
 select*into source from public.leads where id=p_lead_id for update;
 if source.id is null then raise exception'lead_not_found';end if;
 if source.converted_client_id is not null then return source.converted_client_id;end if;
 insert into public.clients(company_name,short_name,client_type,contact_name,phone,email,source,status,notes,created_by,updated_by)
 values(source.company_name,source.company_name,p_client_type,source.contact_name,source.phone,source.email,source.source,'active',source.description,auth.uid(),auth.uid())returning id into new_client_id;
 update public.leads set status='won',converted_client_id=new_client_id,updated_by=auth.uid()where id=p_lead_id;
 insert into public.lead_activities(lead_id,activity_type,note,created_by)values(p_lead_id,'status_change','Lead müşteri kaydına dönüştürüldü.',auth.uid());
 return new_client_id;
end$$;
grant execute on function public.convert_lead_to_client(uuid,public.client_type)to authenticated;
