do $$
declare target_id uuid; source_id uuid;
begin
  select id into target_id from public.accounts where name in('Nakit Kasa','Faturasız Nakit Kasa') order by(name='Nakit Kasa')desc limit 1;
  select id into source_id from public.accounts where name='Faturalı Nakit Kasa' limit 1;
  if target_id is null and source_id is not null then
    update public.accounts set name='Nakit Kasa',account_type='cash',status='active' where id=source_id;
    target_id:=source_id;source_id:=null;
  elsif target_id is not null then
    update public.accounts set name='Nakit Kasa',account_type='cash',status='active',notes='Elden yapılan tüm tahsilat ve ödemeler için ortak nakit kasa.' where id=target_id;
  end if;
  if target_id is not null and source_id is not null and target_id<>source_id then
    update public.finance_transactions set account_id=target_id where account_id=source_id;
    update public.payments set account_id=target_id where account_id=source_id;
    update public.vendor_payments set account_id=target_id where account_id=source_id;
    update public.payroll_payments set account_id=target_id where account_id=source_id;
    update public.unallocated_customer_receipts set account_id=target_id where account_id=source_id;
    update public.accounts t set opening_balance=t.opening_balance+(select opening_balance from public.accounts where id=source_id)where t.id=target_id;
    update public.accounts set status='archived',name='Faturalı Nakit Kasa (Birleştirildi)' where id=source_id;
  end if;
end$$;

update public.accounts set opening_balance=100000 where name='Şirket Gider Kasası';
update public.accounts set opening_balance=40000 where name='Faturasız Gider Kasası';

create or replace function public.pay_vendor_accrual(p_accrual_id uuid,p_account_id uuid,p_amount numeric,p_payment_date date,p_notes text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare accrual public.vendor_accruals%rowtype; account_currency public.currency_code; account_billing public.billing_preference; selected_account_type public.account_type; paid numeric; tx_id uuid; payment_id uuid; new_status public.accrual_status;
begin
  if not(public.has_permission('vendors.manage')and public.has_permission('accounts.manage'))then raise exception'insufficient_permission'using errcode='42501';end if;
  select*into accrual from public.vendor_accruals where id=p_accrual_id for update;
  if not found then raise exception'accrual_not_found';end if;
  if accrual.requires_amount_review then raise exception'amount_review_required';end if;
  select currency,billing_preference,account_type into account_currency,account_billing,selected_account_type from public.accounts where id=p_account_id and status='active';
  if account_currency is null or account_currency<>accrual.currency then raise exception'currency_mismatch_or_account_missing';end if;
  if selected_account_type<>'cash'and account_billing<>accrual.billing_preference then raise exception'billing_preference_mismatch';end if;
  select coalesce(sum(amount),0)into paid from public.vendor_payments where vendor_accrual_id=p_accrual_id;
  if p_amount<=0 or paid+p_amount>accrual.amount then raise exception'invalid_payment_amount';end if;
  insert into public.finance_transactions(account_id,transaction_date,transaction_type,amount,currency,project_id,vendor_id,category,description,created_by)values(p_account_id,p_payment_date,'expense',-p_amount,accrual.currency,accrual.project_id,accrual.vendor_id,'Tedarikçi ödemesi',p_notes,auth.uid())returning id into tx_id;
  insert into public.vendor_payments(vendor_accrual_id,account_id,amount,currency,payment_date,transaction_id,notes,created_by)values(p_accrual_id,p_account_id,p_amount,accrual.currency,p_payment_date,tx_id,p_notes,auth.uid())returning id into payment_id;
  paid:=paid+p_amount;new_status:=case when paid>=accrual.amount then'paid'::public.accrual_status else'partial'::public.accrual_status end;
  update public.vendor_accruals set status=new_status where id=p_accrual_id;
  return payment_id;
end$$;
