create or replace function public.monthly_collection_cash_summary(p_year integer,p_month integer)
returns jsonb language sql stable security invoker set search_path='' as $$
  with bounds as (
    select make_date(p_year,p_month,1) as starts_at,
           (make_date(p_year,p_month,1)+interval '1 month'-interval '1 day')::date as ends_at
  ), project_payments as (
    select coalesce(sum(payment.amount),0) amount
    from public.payments payment
    join public.receivables receivable on receivable.id=payment.receivable_id
    join public.projects project on project.id=receivable.project_id
    join public.service_periods period on period.id=receivable.service_period_id
    cross join bounds
    where payment.payment_date between bounds.starts_at and bounds.ends_at
      and payment.counts_as_cash
      and project.status='active'
      and period.year=p_year
      and period.month>=case when p_year=2026 then 8 else 1 end
  ), excess_receipts as (
    select coalesce(sum(receipt.amount),0) amount
    from public.unallocated_customer_receipts receipt
    join public.receivables receivable on receivable.id=receipt.source_receivable_id
    join public.projects project on project.id=receivable.project_id
    join public.service_periods period on period.id=receivable.service_period_id
    cross join bounds
    where receipt.received_date between bounds.starts_at and bounds.ends_at
      and receipt.status<>'refunded'
      and project.status='active'
      and period.year=p_year
      and period.month>=case when p_year=2026 then 8 else 1 end
  ), manual_income as (
    select coalesce(sum(income.amount),0) amount from public.manual_incomes income cross join bounds
    where income.payment_date between bounds.starts_at and bounds.ends_at
  ), hosting_income as (
    select coalesce(sum(payment.amount),0) amount from public.hosting_payments payment cross join bounds
    where payment.payment_date between bounds.starts_at and bounds.ends_at
  )
  select jsonb_build_object(
    'project_payments',project_payments.amount,
    'excess_receipts',excess_receipts.amount,
    'manual_income',manual_income.amount,
    'hosting_income',hosting_income.amount,
    'total',project_payments.amount+excess_receipts.amount+manual_income.amount+hosting_income.amount
  )
  from project_payments,excess_receipts,manual_income,hosting_income;
$$;

grant execute on function public.monthly_collection_cash_summary(integer,integer) to authenticated;
