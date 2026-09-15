alter table public.payments
  add column if not exists counts_as_cash boolean not null default true,
  add column if not exists payment_channel_note text;

comment on column public.payments.counts_as_cash is
  'False olduğunda ödeme alacağı kapatır ancak şirket kasası tahsilatına dahil edilmez.';

comment on column public.payments.payment_channel_note is
  'Şirket kasası dışındaki ödeme kanalının kullanıcıya gösterilen açıklaması.';

do $$
declare
  target_payment record;
  linked_amount numeric;
begin
  for target_payment in
    select payment.id, payment.bulk_transaction_id, payment.amount
    from public.payments payment
    join public.receivables receivable on receivable.id = payment.receivable_id
    join public.service_periods period on period.id = receivable.service_period_id
    join public.projects project on project.id = period.project_id
    join public.services service on service.id = period.service_id
    where lower(coalesce(project.domain, '')) = 'mervenakyuz.com'
      and lower(service.name) = lower('Trendyol Reklam')
      and payment.payment_date = date '2026-08-12'
      and payment.amount = 31000
  loop
    update public.payments
    set
      counts_as_cash = false,
      payment_channel_note = 'Müşteri doğrudan Tuğrul Piltan’a ödedi.'
    where id = target_payment.id;

    if target_payment.bulk_transaction_id is null then
      delete from public.finance_transactions where payment_id = target_payment.id;
    else
      select amount into linked_amount
      from public.finance_transactions
      where id = target_payment.bulk_transaction_id
      for update;

      if linked_amount - target_payment.amount > 0 then
        update public.finance_transactions
        set amount = linked_amount - target_payment.amount
        where id = target_payment.bulk_transaction_id;
      else
        update public.payments
        set bulk_transaction_id = null
        where bulk_transaction_id = target_payment.bulk_transaction_id;
        delete from public.finance_transactions where id = target_payment.bulk_transaction_id;
      end if;
    end if;
  end loop;
end
$$;
