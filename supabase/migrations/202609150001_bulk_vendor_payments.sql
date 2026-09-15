create or replace function public.pay_vendor_accruals_bulk(
  p_accrual_ids uuid[], p_account_id uuid, p_amount numeric, p_payment_date date, p_notes text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  first_accrual public.vendor_accruals%rowtype;
  accrual public.vendor_accruals%rowtype;
  account_currency public.currency_code;
  account_billing public.billing_preference;
  selected_account_type public.account_type;
  total_remaining numeric:=0;
  already_paid numeric;
  allocation numeric;
  amount_left numeric:=p_amount;
  tx_id uuid;
  first_payment boolean:=true;
begin
  if not(public.has_permission('vendors.manage') and public.has_permission('accounts.manage')) then
    raise exception'insufficient_permission' using errcode='42501';
  end if;
  if p_accrual_ids is null or cardinality(p_accrual_ids)=0 then raise exception'accrual_not_found'; end if;
  select * into first_accrual from public.vendor_accruals where id=p_accrual_ids[1] for update;
  if not found then raise exception'accrual_not_found'; end if;
  select currency,billing_preference,account_type into account_currency,account_billing,selected_account_type
    from public.accounts where id=p_account_id and status='active';
  if account_currency is null or account_currency<>first_accrual.currency then raise exception'currency_mismatch_or_account_missing'; end if;
  if selected_account_type<>'cash' and account_billing<>first_accrual.billing_preference then raise exception'billing_preference_mismatch'; end if;

  for accrual in select * from public.vendor_accruals where id=any(p_accrual_ids) order by due_date nulls last,id for update loop
    if accrual.vendor_id<>first_accrual.vendor_id or accrual.currency<>first_accrual.currency or accrual.billing_preference<>first_accrual.billing_preference then raise exception'mixed_vendor_or_currency'; end if;
    if accrual.requires_amount_review then raise exception'amount_review_required'; end if;
    select coalesce(sum(amount),0) into already_paid from public.vendor_payments where vendor_accrual_id=accrual.id;
    total_remaining:=total_remaining+greatest(accrual.amount-already_paid,0);
  end loop;
  if p_amount<=0 or p_amount>total_remaining then raise exception'invalid_payment_amount'; end if;

  insert into public.finance_transactions(account_id,transaction_date,transaction_type,amount,currency,vendor_id,category,description,created_by)
  values(p_account_id,p_payment_date,'expense',-p_amount,first_accrual.currency,first_accrual.vendor_id,'Toplu tedarikçi ödemesi',p_notes,auth.uid()) returning id into tx_id;

  for accrual in select * from public.vendor_accruals where id=any(p_accrual_ids) order by due_date nulls last,id for update loop
    exit when amount_left<=0;
    select coalesce(sum(amount),0) into already_paid from public.vendor_payments where vendor_accrual_id=accrual.id;
    allocation:=least(amount_left,greatest(accrual.amount-already_paid,0));
    if allocation>0 then
      insert into public.vendor_payments(vendor_accrual_id,account_id,amount,currency,payment_date,transaction_id,notes,created_by,payment_channel)
      values(accrual.id,p_account_id,allocation,accrual.currency,p_payment_date,case when first_payment then tx_id else null end,p_notes,auth.uid(),'cash_account');
      first_payment:=false;
      amount_left:=amount_left-allocation;
      update public.vendor_accruals set status=case when already_paid+allocation>=amount then'paid'::public.accrual_status else'partial'::public.accrual_status end where id=accrual.id;
    end if;
  end loop;
  return tx_id;
end$$;

grant execute on function public.pay_vendor_accruals_bulk(uuid[],uuid,numeric,date,text) to authenticated;
