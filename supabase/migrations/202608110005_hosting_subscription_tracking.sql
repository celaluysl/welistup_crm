create table public.hosting_subscriptions(
  id uuid primary key default gen_random_uuid(),domain text not null unique,client_id uuid references public.clients(id),account_label text,
  status public.record_status not null default'active',is_paid boolean not null default true,installation_date date,
  next_payment_date date,renewal_months integer not null default 12 check(renewal_months between 1 and 60),
  fee numeric(18,2)not null default 0 check(fee>=0),currency public.currency_code not null default'TRY',notes text,
  created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.hosting_receivables(
  id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.hosting_subscriptions(id),client_id uuid references public.clients(id),
  due_date date not null,amount numeric(18,2)not null check(amount>=0),currency public.currency_code not null,
  billing_preference public.billing_preference,status text not null default'classification_pending' check(status in('classification_pending','pending','partial','paid','cancelled')),
  notes text,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(subscription_id,due_date)
);
create table public.hosting_payments(
  id uuid primary key default gen_random_uuid(),hosting_receivable_id uuid not null references public.hosting_receivables(id),account_id uuid not null references public.accounts(id),
  amount numeric(18,2)not null check(amount>0),currency public.currency_code not null,payment_date date not null,
  transaction_id uuid unique references public.finance_transactions(id),notes text,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create index hosting_subscriptions_due_idx on public.hosting_subscriptions(status,next_payment_date);
create index hosting_receivables_due_idx on public.hosting_receivables(status,due_date);
create trigger set_updated_at before update on public.hosting_subscriptions for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.hosting_receivables for each row execute function public.set_updated_at();
alter table public.hosting_subscriptions enable row level security;alter table public.hosting_receivables enable row level security;alter table public.hosting_payments enable row level security;
create policy hosting_subscriptions_read on public.hosting_subscriptions for select to authenticated using(public.has_permission('collections.read'));
create policy hosting_subscriptions_manage on public.hosting_subscriptions for all to authenticated using(public.has_permission('collections.manage'))with check(public.has_permission('collections.manage'));
create policy hosting_receivables_read on public.hosting_receivables for select to authenticated using(public.has_permission('collections.read'));
create policy hosting_receivables_manage on public.hosting_receivables for all to authenticated using(public.has_permission('collections.manage'))with check(public.has_permission('collections.manage'));
create policy hosting_payments_read on public.hosting_payments for select to authenticated using(public.has_permission('collections.read'));
create policy hosting_payments_insert on public.hosting_payments for insert to authenticated with check(public.has_permission('collections.manage')and created_by=auth.uid());

create or replace function public.generate_hosting_receivables()returns integer language plpgsql security definer set search_path=''as $$
declare h record;created_count integer:=0;begin
 for h in select*from public.hosting_subscriptions where status='active'and is_paid and fee>0 and next_payment_date is not null and next_payment_date<=current_date+30 loop
  insert into public.hosting_receivables(subscription_id,client_id,due_date,amount,currency,notes,created_by)
  values(h.id,h.client_id,h.next_payment_date,h.fee,h.currency,'Faturalama türü seçilmeli.',h.created_by)on conflict(subscription_id,due_date)do nothing;
  if found then created_count:=created_count+1;update public.hosting_subscriptions set next_payment_date=(next_payment_date+(renewal_months||' months')::interval)::date where id=h.id;end if;
 end loop;return created_count;end$$;
create or replace function public.classify_hosting_receivable(p_receivable_id uuid,p_billing public.billing_preference)returns void language plpgsql security invoker set search_path=''as $$begin
 if not public.has_permission('collections.manage')then raise exception'insufficient_permission'using errcode='42501';end if;
 update public.hosting_receivables set billing_preference=p_billing,status='pending',notes=null where id=p_receivable_id and status='classification_pending';
 if not found then raise exception'hosting_receivable_not_pending';end if;end$$;
create or replace function public.pay_hosting_receivable(p_receivable_id uuid,p_account_id uuid,p_amount numeric,p_payment_date date,p_notes text)returns uuid language plpgsql security invoker set search_path=''as $$
declare r public.hosting_receivables%rowtype;a_currency public.currency_code;a_billing public.billing_preference;paid numeric;tx uuid;payment_id uuid;begin
 if not(public.has_permission('collections.manage')and public.has_permission('accounts.manage'))then raise exception'insufficient_permission'using errcode='42501';end if;
 select*into r from public.hosting_receivables where id=p_receivable_id for update;if not found then raise exception'hosting_receivable_not_found';end if;
 if r.billing_preference is null then raise exception'classification_required';end if;
 select currency,billing_preference into a_currency,a_billing from public.accounts where id=p_account_id and status='active';
 if a_currency<>r.currency then raise exception'currency_mismatch';end if;if a_billing<>r.billing_preference then raise exception'billing_preference_mismatch';end if;
 select coalesce(sum(amount),0)into paid from public.hosting_payments where hosting_receivable_id=r.id;
 if p_amount<=0 or paid+p_amount>r.amount then raise exception'invalid_payment_amount';end if;
 insert into public.finance_transactions(account_id,transaction_date,transaction_type,amount,currency,client_id,category,description,created_by)
 values(p_account_id,p_payment_date,'income',p_amount,r.currency,r.client_id,'Sunucu ödemesi',p_notes,auth.uid())returning id into tx;
 insert into public.hosting_payments(hosting_receivable_id,account_id,amount,currency,payment_date,transaction_id,notes,created_by)
 values(r.id,p_account_id,p_amount,r.currency,p_payment_date,tx,p_notes,auth.uid())returning id into payment_id;
 paid:=paid+p_amount;update public.hosting_receivables set status=case when paid>=amount then'paid'else'partial'end where id=r.id;return payment_id;end$$;
revoke all on function public.generate_hosting_receivables()from public;
grant execute on function public.generate_hosting_receivables()to authenticated;
grant execute on function public.classify_hosting_receivable(uuid,public.billing_preference)to authenticated;
grant execute on function public.pay_hosting_receivable(uuid,uuid,numeric,date,text)to authenticated;
select public.generate_hosting_receivables();
do $$begin
 if exists(select 1 from cron.job where jobname='welistup-daily-hosting-receivables')then perform cron.unschedule('welistup-daily-hosting-receivables');end if;
 perform cron.schedule('welistup-daily-hosting-receivables','30 0 * * *','select public.generate_hosting_receivables();');
end$$;
