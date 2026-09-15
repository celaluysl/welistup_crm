create or replace function public.monthly_open_receivables(p_year integer,p_month integer)
returns table(
  receivable_id uuid,
  client_id uuid,
  client_name text,
  project_name text,
  period_year integer,
  period_month integer,
  due_date date,
  status text,
  total_amount numeric,
  paid_amount numeric,
  open_amount numeric
)
language sql stable security invoker set search_path='' as $$
  select
    receivable.id,
    client.id,
    client.company_name,
    project.name,
    period.year,
    period.month,
    receivable.due_date,
    receivable.status::text,
    receivable.total_amount,
    coalesce(payment.paid_amount,0),
    greatest(receivable.total_amount-coalesce(payment.paid_amount,0),0)
  from public.receivables receivable
  join public.clients client on client.id=receivable.client_id
  join public.projects project on project.id=receivable.project_id
  join public.service_periods period on period.id=receivable.service_period_id
  left join lateral(
    select coalesce(sum(p.amount),0) paid_amount
    from public.payments p
    where p.receivable_id=receivable.id
  )payment on true
  where project.status='active'
    and not receivable.settled_without_cash
    and receivable.status::text<>'paid'
    and period.year*12+period.month>=2026*12+8
    and period.year*12+period.month<=p_year*12+p_month
    and receivable.total_amount-coalesce(payment.paid_amount,0)>0
  order by period.year,period.month,receivable.due_date,client.company_name;
$$;

grant execute on function public.monthly_open_receivables(integer,integer) to authenticated;
