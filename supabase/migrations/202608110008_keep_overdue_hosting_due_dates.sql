create or replace function public.generate_hosting_receivables()
returns integer language plpgsql security definer set search_path=''as $$
declare h record;created_count integer:=0;
begin
  for h in select*from public.hosting_subscriptions
    where status='active'and is_paid and fee>0 and next_payment_date is not null
      and next_payment_date<=current_date+30
  loop
    insert into public.hosting_receivables(subscription_id,client_id,due_date,amount,currency,notes,created_by)
    values(h.id,h.client_id,h.next_payment_date,h.fee,h.currency,'Faturalama türü seçilmeli.',h.created_by)
    on conflict(subscription_id,due_date)do nothing;
    if found then created_count:=created_count+1;end if;
  end loop;
  return created_count;
end$$;

create or replace function public.pay_hosting_receivable(p_receivable_id uuid,p_account_id uuid,p_amount numeric,p_payment_date date,p_notes text)
returns uuid language plpgsql security invoker set search_path=''as $$
declare r public.hosting_receivables%rowtype;a_currency public.currency_code;a_billing public.billing_preference;paid numeric;tx uuid;payment_id uuid;
begin
  if not(public.has_permission('collections.manage')and public.has_permission('accounts.manage'))then raise exception'insufficient_permission'using errcode='42501';end if;
  select*into r from public.hosting_receivables where id=p_receivable_id for update;
  if not found then raise exception'hosting_receivable_not_found';end if;
  if r.billing_preference is null then raise exception'classification_required';end if;
  select currency,billing_preference into a_currency,a_billing from public.accounts where id=p_account_id and status='active';
  if a_currency<>r.currency then raise exception'currency_mismatch';end if;
  if a_billing<>r.billing_preference then raise exception'billing_preference_mismatch';end if;
  select coalesce(sum(amount),0)into paid from public.hosting_payments where hosting_receivable_id=r.id;
  if p_amount<=0 or paid+p_amount>r.amount then raise exception'invalid_payment_amount';end if;
  insert into public.finance_transactions(account_id,transaction_date,transaction_type,amount,currency,client_id,category,description,created_by)
  values(p_account_id,p_payment_date,'income',p_amount,r.currency,r.client_id,'Sunucu ödemesi',p_notes,auth.uid())returning id into tx;
  insert into public.hosting_payments(hosting_receivable_id,account_id,amount,currency,payment_date,transaction_id,notes,created_by)
  values(r.id,p_account_id,p_amount,r.currency,p_payment_date,tx,p_notes,auth.uid())returning id into payment_id;
  paid:=paid+p_amount;
  update public.hosting_receivables set status=case when paid>=amount then'paid'else'partial'end where id=r.id;
  if paid>=r.amount then
    update public.hosting_subscriptions
      set next_payment_date=(r.due_date+(renewal_months||' months')::interval)::date
      where id=r.subscription_id and next_payment_date<=r.due_date;
  end if;
  return payment_id;
end$$;

with source(domain,next_payment_date)as(values
  ('epos7.org',date'2025-07-13'),('avsarpool.com',date'2026-03-15'),
  ('halifleksyikama.org',date'2026-03-15'),('spmpsikoloji.com',date'2026-04-05'),
  ('zirvedekalsuit.com',date'2026-04-17'),('yenitokatamasya.com',date'2026-04-19'),
  ('stormsmultimedia.com',date'2026-04-26'),('tekindaginsaat.com',date'2026-10-10'),
  ('polatyapigroup.com',date'2026-10-11'),('dryaseminsavas.com',date'2026-11-14'),
  ('yagmurdanismanlik.com',date'2026-11-20'),('amerikadalise.org',date'2026-11-28'),
  ('pivokevents.com.tr',date'2026-12-10'),('lifetemizlik.com',date'2026-12-14'),
  ('gowest.com.tr',date'2027-02-01'),('veziryatak.com',date'2027-02-07'),
  ('drkpeyzaj.com',date'2027-05-20'),('dorukgayrimenkulemlak.com.tr',date'2027-05-31'),
  ('bahadirogullari.com',date'2027-07-19')
)
delete from public.hosting_receivables r using public.hosting_subscriptions s,source
where r.subscription_id=s.id and s.domain=source.domain
  and r.due_date<>source.next_payment_date
  and not exists(select 1 from public.hosting_payments p where p.hosting_receivable_id=r.id);

with source(domain,next_payment_date)as(values
  ('epos7.org',date'2025-07-13'),('avsarpool.com',date'2026-03-15'),
  ('halifleksyikama.org',date'2026-03-15'),('spmpsikoloji.com',date'2026-04-05'),
  ('zirvedekalsuit.com',date'2026-04-17'),('yenitokatamasya.com',date'2026-04-19'),
  ('stormsmultimedia.com',date'2026-04-26'),('tekindaginsaat.com',date'2026-10-10'),
  ('polatyapigroup.com',date'2026-10-11'),('dryaseminsavas.com',date'2026-11-14'),
  ('yagmurdanismanlik.com',date'2026-11-20'),('amerikadalise.org',date'2026-11-28'),
  ('pivokevents.com.tr',date'2026-12-10'),('lifetemizlik.com',date'2026-12-14'),
  ('gowest.com.tr',date'2027-02-01'),('veziryatak.com',date'2027-02-07'),
  ('drkpeyzaj.com',date'2027-05-20'),('dorukgayrimenkulemlak.com.tr',date'2027-05-31'),
  ('bahadirogullari.com',date'2027-07-19')
)
update public.hosting_subscriptions s set next_payment_date=source.next_payment_date
from source where s.domain=source.domain;

select public.generate_hosting_receivables();
