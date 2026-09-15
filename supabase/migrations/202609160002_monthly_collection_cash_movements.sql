create or replace function public.monthly_collection_cash_movements(p_year integer,p_month integer)
returns table(
  movement_type text,
  title text,
  movement_date date,
  account_name text,
  billing_preference text,
  notes text,
  amount numeric
)
language sql stable security invoker set search_path='' as $$
  with bounds as (
    select make_date(p_year,p_month,1) as starts_at,
           (make_date(p_year,p_month,1)+interval '1 month'-interval '1 day')::date as ends_at
  )
  select 'payment',client.company_name||' · '||project.name,payment.payment_date,account.name,account.billing_preference::text,payment.notes,payment.amount
  from public.payments payment
  join public.receivables receivable on receivable.id=payment.receivable_id
  join public.clients client on client.id=receivable.client_id
  join public.projects project on project.id=receivable.project_id
  join public.service_periods period on period.id=receivable.service_period_id
  left join public.accounts account on account.id=payment.account_id
  cross join bounds
  where payment.payment_date between bounds.starts_at and bounds.ends_at
    and payment.counts_as_cash and project.status='active'
    and period.year=p_year and period.month>=case when p_year=2026 then 8 else 1 end
  union all
  select 'excess',client.company_name||' · Ek tahsilat',receipt.received_date,account.name,account.billing_preference::text,receipt.notes,receipt.amount
  from public.unallocated_customer_receipts receipt
  join public.receivables receivable on receivable.id=receipt.source_receivable_id
  join public.clients client on client.id=receipt.client_id
  join public.projects project on project.id=receivable.project_id
  join public.service_periods period on period.id=receivable.service_period_id
  left join public.accounts account on account.id=receipt.account_id
  cross join bounds
  where receipt.received_date between bounds.starts_at and bounds.ends_at
    and receipt.status<>'refunded' and project.status='active'
    and period.year=p_year and period.month>=case when p_year=2026 then 8 else 1 end
  union all
  select 'manual',income.notes,income.payment_date,account.name,account.billing_preference::text,income.notes,income.amount
  from public.manual_incomes income
  left join public.accounts account on account.id=income.account_id
  cross join bounds
  where income.payment_date between bounds.starts_at and bounds.ends_at
  union all
  select 'hosting',coalesce(client.company_name,subscription.domain,subscription.account_label,'Hosting')||' · Hosting',payment.payment_date,account.name,account.billing_preference::text,payment.notes,payment.amount
  from public.hosting_payments payment
  join public.hosting_receivables receivable on receivable.id=payment.hosting_receivable_id
  join public.hosting_subscriptions subscription on subscription.id=receivable.subscription_id
  left join public.clients client on client.id=receivable.client_id
  left join public.accounts account on account.id=payment.account_id
  cross join bounds
  where payment.payment_date between bounds.starts_at and bounds.ends_at
  order by movement_date,title;
$$;

grant execute on function public.monthly_collection_cash_movements(integer,integer) to authenticated;
