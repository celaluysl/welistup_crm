insert into public.accounts(
  name,
  account_type,
  currency,
  billing_preference,
  opening_balance,
  notes,
  created_by
)
select
  seed.name,
  'cash'::public.account_type,
  'TRY'::public.currency_code,
  seed.billing::public.billing_preference,
  0,
  'Elden alınan müşteri tahsilatları için nakit kasa.',
  profile.id
from (
  values
    ('Faturalı Nakit Kasa', 'invoiced'),
    ('Faturasız Nakit Kasa', 'uninvoiced')
) as seed(name, billing)
cross join lateral (
  select id from public.profiles order by created_at limit 1
) as profile
on conflict (name) do update
set account_type = excluded.account_type,
    currency = excluded.currency,
    billing_preference = excluded.billing_preference,
    status = 'active',
    notes = excluded.notes;
