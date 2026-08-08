create or replace function public.delete_offer(p_offer_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('sales.manage') then raise exception 'insufficient_permission' using errcode='42501'; end if;
  if exists(select 1 from public.proformas where offer_id=p_offer_id) then raise exception 'linked_proforma'; end if;
  delete from public.offer_revision_items where revision_id in(select id from public.offer_revisions where offer_id=p_offer_id);
  delete from public.offer_revisions where offer_id=p_offer_id;
  delete from public.offers where id=p_offer_id;
end $$;
grant execute on function public.delete_offer(uuid) to authenticated;

create or replace function public.delete_proforma(p_proforma_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('sales.manage') then raise exception 'insufficient_permission' using errcode='42501'; end if;
  delete from public.proforma_items where proforma_id=p_proforma_id;
  delete from public.proformas where id=p_proforma_id;
end $$;
grant execute on function public.delete_proforma(uuid) to authenticated;

create or replace function public.update_proforma(
  p_proforma_id uuid,p_client_id uuid,p_customer_name text,p_customer_legal_name text,
  p_customer_tax_office text,p_customer_tax_number text,p_customer_address text,
  p_customer_phone text,p_customer_email text,p_issue_date date,p_valid_until date,
  p_currency public.currency_code,p_bank_details text,p_description text,p_payment_terms text,p_items jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;client_row public.clients%rowtype;subtotal_value numeric:=0;discount_value numeric:=0;vat_value numeric:=0;grand_value numeric:=0;line_base numeric;line_discount numeric;line_net_value numeric;line_vat_value numeric;position_value integer:=0;
begin
  if not public.has_permission('sales.manage') then raise exception 'insufficient_permission' using errcode='42501'; end if;
  if not exists(select 1 from public.proformas where id=p_proforma_id) then raise exception 'proforma_not_found'; end if;
  if p_client_id is not null then
    select * into client_row from public.clients where id=p_client_id and status='active';
    if client_row.id is null then raise exception 'client_not_found'; end if;
    p_customer_name:=client_row.company_name;p_customer_legal_name:=client_row.legal_name;p_customer_tax_office:=client_row.tax_office;p_customer_tax_number:=client_row.tax_number;p_customer_address:=client_row.address;p_customer_phone:=client_row.phone;p_customer_email:=client_row.email;
  elsif nullif(trim(p_customer_name),'') is null then raise exception 'customer_name_required'; end if;
  if jsonb_array_length(p_items)=0 then raise exception 'proforma_requires_items'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    line_base:=round((item->>'quantity')::numeric*(item->>'unit_price')::numeric,2);line_discount:=round(line_base*coalesce((item->>'discount_rate')::numeric,0)/100,2);line_net_value:=line_base-line_discount;line_vat_value:=round(line_net_value*coalesce((item->>'vat_rate')::numeric,0)/100,2);subtotal_value:=subtotal_value+line_base;discount_value:=discount_value+line_discount;vat_value:=vat_value+line_vat_value;grand_value:=grand_value+line_net_value+line_vat_value;
  end loop;
  update public.proformas set client_id=p_client_id,customer_name=p_customer_name,customer_legal_name=p_customer_legal_name,customer_tax_office=p_customer_tax_office,customer_tax_number=p_customer_tax_number,customer_address=p_customer_address,customer_phone=p_customer_phone,customer_email=p_customer_email,issue_date=p_issue_date,valid_until=p_valid_until,currency=p_currency,bank_details=p_bank_details,description=p_description,payment_terms=p_payment_terms,subtotal=subtotal_value,total_discount=discount_value,total_vat=vat_value,grand_total=grand_value where id=p_proforma_id;
  delete from public.proforma_items where proforma_id=p_proforma_id;
  for item in select * from jsonb_array_elements(p_items) loop
    line_base:=round((item->>'quantity')::numeric*(item->>'unit_price')::numeric,2);line_discount:=round(line_base*coalesce((item->>'discount_rate')::numeric,0)/100,2);line_net_value:=line_base-line_discount;line_vat_value:=round(line_net_value*coalesce((item->>'vat_rate')::numeric,0)/100,2);
    insert into public.proforma_items(proforma_id,service_name,description,quantity,unit_price,discount_rate,vat_rate,line_net,line_vat,line_total,position) values(p_proforma_id,item->>'service_name',item->>'description',(item->>'quantity')::numeric,(item->>'unit_price')::numeric,coalesce((item->>'discount_rate')::numeric,0),coalesce((item->>'vat_rate')::numeric,0),line_net_value,line_vat_value,line_net_value+line_vat_value,position_value);position_value:=position_value+1;
  end loop;
end $$;
grant execute on function public.update_proforma(uuid,uuid,text,text,text,text,text,text,text,date,date,public.currency_code,text,text,text,jsonb) to authenticated;
