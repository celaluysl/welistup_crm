create or replace function public.admin_reset_user_password(
  p_user_id uuid,
  p_new_password text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('team.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if length(p_new_password) < 8 then
    raise exception 'password_too_short' using errcode = '22023';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmation_token = '',
         updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_reset_user_password(uuid, text) from public;
grant execute on function public.admin_reset_user_password(uuid, text) to authenticated;
