with source(domain,account_label,installation_date,next_payment_date)as(values
  ('epos7.org','Aktif Müşteriler',date'2024-07-13',date'2025-07-13'),
  ('avsarpool.com','Aktif Müşteriler',date'2025-03-15',date'2026-03-15'),
  ('halifleksyikama.org','Cüneyt Bağcı',date'2025-03-15',date'2026-03-15'),
  ('spmpsikoloji.com','Aktif Müşteriler',date'2025-04-05',date'2026-04-05'),
  ('zirvedekalsuit.com','Celal Uysal',date'2025-04-17',date'2026-04-17'),
  ('yenitokatamasya.com','Aktif Müşteriler',date'2024-04-19',date'2026-04-19'),
  ('stormsmultimedia.com','Aktif Müşteriler',date'2025-04-26',date'2026-04-26'),
  ('tekindaginsaat.com','Aktif Müşteriler',date'2025-10-10',date'2026-10-10'),
  ('polatyapigroup.com','Aktif Müşteriler',date'2025-10-11',date'2026-10-11'),
  ('dryaseminsavas.com','Welistup',date'2023-11-14',date'2026-11-14'),
  ('yagmurdanismanlik.com','Administrator',date'2024-11-20',date'2026-11-20'),
  ('amerikadalise.org','Aktif Müşteriler',date'2025-11-28',date'2026-11-28'),
  ('pivokevents.com.tr','Aktif Müşteriler',date'2025-12-10',date'2026-12-10'),
  ('lifetemizlik.com','Cüneyt Bağcı',date'2025-12-14',date'2026-12-14'),
  ('gowest.com.tr','Administrator',date'2024-04-30',date'2027-02-01'),
  ('veziryatak.com','Aktif Müşteriler',date'2023-02-07',date'2027-02-07'),
  ('drkpeyzaj.com','Administrator',date'2024-05-20',date'2027-05-20'),
  ('dorukgayrimenkulemlak.com.tr','Aktif Müşteriler',date'2023-05-31',date'2027-05-31'),
  ('bahadirogullari.com','Aktif Müşteriler',date'2024-07-19',date'2027-07-19')
),resolved as(
  select source.*,
    coalesce(
      (select projects.client_id from public.projects
       where lower(trim(projects.domain))=lower(source.domain)
         and projects.status<>'archived' order by projects.created_at limit 1),
      case when source.domain='lifetemizlik.com'then
        (select clients.id from public.clients
         where clients.status='active'
           and(clients.company_name ilike'%Bağcı%'or clients.short_name ilike'%Bağcı%')
         order by clients.created_at limit 1)
      end
    )client_id
  from source
),actor as(
  select id from public.profiles
  order by case when lower(email)='admin@welistup.com'then 0 else 1 end,created_at
  limit 1
)
insert into public.hosting_subscriptions(
  domain,client_id,account_label,status,is_paid,installation_date,next_payment_date,
  renewal_months,fee,currency,notes,created_by
)
select resolved.domain,resolved.client_id,resolved.account_label,'active',true,
  resolved.installation_date,resolved.next_payment_date,12,4000,'TRY',
  'Mevcut sunucu takip listesinden aktarıldı.',actor.id
from resolved cross join actor
on conflict(domain)do update set
  client_id=coalesce(excluded.client_id,public.hosting_subscriptions.client_id),
  account_label=excluded.account_label,
  status='active',is_paid=true,
  installation_date=excluded.installation_date,
  next_payment_date=excluded.next_payment_date,
  renewal_months=12,fee=4000,currency='TRY',notes=excluded.notes;

select public.generate_hosting_receivables();
