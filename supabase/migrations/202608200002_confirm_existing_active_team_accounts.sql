update auth.users as auth_user
   set email_confirmed_at = coalesce(auth_user.email_confirmed_at, now()),
       confirmation_token = '',
       updated_at = now()
 where exists (
   select 1
     from public.profiles as profile
    where profile.id = auth_user.id
      and profile.status = 'active'
 );
