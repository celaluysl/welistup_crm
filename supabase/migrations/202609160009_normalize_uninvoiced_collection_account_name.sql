do $$
begin
  if not exists(select 1 from public.accounts where name='Faturasız Tahsilat Kasası') then
    update public.accounts
    set name='Faturasız Tahsilat Kasası'
    where name='Faturasız Tahsilat Kasası (Arif)';
  end if;
end$$;
