create or replace function public.create_standalone_proforma(
  p_client_id uuid,
  p_issue_date date,
  p_valid_until date,
  p_currency public.currency_code,
  p_bank_details text,
  p_description text,
  p_payment_terms text,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
  item jsonb;
  subtotal_value numeric := 0;
  discount_value numeric := 0;
  vat_value numeric := 0;
  grand_value numeric := 0;
  line_base numeric;
  line_discount numeric;
  line_net_value numeric;
  line_vat_value numeric;
  position_value integer := 0;
begin
  if not public.has_permission('sales.manage') then
    raise exception 'insufficient_permission' using errcode = '42501';
  end if;
  if not exists(select 1 from public.clients where id = p_client_id and status = 'active') then
    raise exception 'client_not_found';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'proforma_requires_items';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    line_base := round((item->>'quantity')::numeric * (item->>'unit_price')::numeric, 2);
    line_discount := round(line_base * coalesce((item->>'discount_rate')::numeric, 0) / 100, 2);
    line_net_value := line_base - line_discount;
    line_vat_value := round(line_net_value * coalesce((item->>'vat_rate')::numeric, 0) / 100, 2);
    subtotal_value := subtotal_value + line_base;
    discount_value := discount_value + line_discount;
    vat_value := vat_value + line_vat_value;
    grand_value := grand_value + line_net_value + line_vat_value;
  end loop;

  insert into public.proformas(
    proforma_number, client_id, issue_date, valid_until, currency,
    bank_details, description, payment_terms, subtotal, total_discount,
    total_vat, grand_total, created_by
  ) values (
    'PRF-' || extract(year from p_issue_date)::int || '-' || lpad(nextval('public.proforma_number_seq')::text, 4, '0'),
    p_client_id, p_issue_date, p_valid_until, p_currency, p_bank_details,
    p_description, p_payment_terms, subtotal_value, discount_value,
    vat_value, grand_value, auth.uid()
  ) returning id into new_id;

  for item in select * from jsonb_array_elements(p_items) loop
    line_base := round((item->>'quantity')::numeric * (item->>'unit_price')::numeric, 2);
    line_discount := round(line_base * coalesce((item->>'discount_rate')::numeric, 0) / 100, 2);
    line_net_value := line_base - line_discount;
    line_vat_value := round(line_net_value * coalesce((item->>'vat_rate')::numeric, 0) / 100, 2);
    insert into public.proforma_items(
      proforma_id, service_name, description, quantity, unit_price,
      discount_rate, vat_rate, line_net, line_vat, line_total, position
    ) values (
      new_id, item->>'service_name', item->>'description',
      (item->>'quantity')::numeric, (item->>'unit_price')::numeric,
      coalesce((item->>'discount_rate')::numeric, 0),
      coalesce((item->>'vat_rate')::numeric, 0), line_net_value,
      line_vat_value, line_net_value + line_vat_value, position_value
    );
    position_value := position_value + 1;
  end loop;
  return new_id;
end
$$;

grant execute on function public.create_standalone_proforma(uuid,date,date,public.currency_code,text,text,text,jsonb) to authenticated;
