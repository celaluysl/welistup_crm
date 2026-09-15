alter table public.receivables
  add column if not exists settled_without_cash boolean not null default false,
  add column if not exists settlement_notes text;

comment on column public.receivables.settled_without_cash is
  'Alacağın bu CRM döneminde yeni bir kasa hareketi oluşturmadan karşılandığını belirtir.';

comment on column public.receivables.settlement_notes is
  'Kasa hareketi oluşturmadan kapatma gerekçesi ve önceki ödeme kapsamı.';

update public.receivables r
set
  status = 'paid'::public.collection_status,
  settled_without_cash = true,
  settlement_notes = 'Haziran 2026 tarihinde yapılan üç aylık peşin ödeme kapsamında karşılandı.',
  coverage_start = date '2026-06-01',
  coverage_end = date '2026-08-31'
from public.service_periods sp
join public.projects p on p.id = sp.project_id
where r.service_period_id = sp.id
  and sp.year = 2026
  and sp.month = 8
  and lower(coalesce(p.domain, '')) = 'kucukdeveci.com.tr'
  and not exists (
    select 1 from public.payments payment where payment.receivable_id = r.id
  );

update public.service_periods sp
set
  collection_status = 'paid'::public.collection_status,
  notes = concat_ws(E'\n', nullif(sp.notes, ''), 'Haziran 2026 tarihinde yapılan üç aylık peşin ödeme kapsamında karşılandı.')
from public.projects p
where p.id = sp.project_id
  and sp.year = 2026
  and sp.month = 8
  and lower(coalesce(p.domain, '')) = 'kucukdeveci.com.tr'
  and exists (
    select 1
    from public.receivables r
    where r.service_period_id = sp.id
      and r.settled_without_cash
  );
