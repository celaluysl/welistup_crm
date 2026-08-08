create or replace function public.enforce_uninvoiced_zero_vat()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.project_services
    where id = new.project_service_id
      and billing_preference = 'uninvoiced'
  ) then
    new.vat_rate := 0;
  end if;
  return new;
end $$;

drop trigger if exists enforce_uninvoiced_zero_vat
on public.project_service_prices;

create trigger enforce_uninvoiced_zero_vat
before insert or update on public.project_service_prices
for each row execute function public.enforce_uninvoiced_zero_vat();

update public.project_service_prices price
set vat_rate = 0
from public.project_services service
where service.id = price.project_service_id
  and service.billing_preference = 'uninvoiced'
  and price.vat_rate <> 0;
