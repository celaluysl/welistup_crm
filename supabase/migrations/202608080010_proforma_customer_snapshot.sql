alter table public.proformas alter column client_id drop not null;
alter table public.proformas add column if not exists customer_name text;
alter table public.proformas add column if not exists customer_legal_name text;
alter table public.proformas add column if not exists customer_tax_office text;
alter table public.proformas add column if not exists customer_tax_number text;
alter table public.proformas add column if not exists customer_address text;
alter table public.proformas add column if not exists customer_phone text;
alter table public.proformas add column if not exists customer_email text;

update public.proformas p set
  customer_name = c.company_name,
  customer_legal_name = c.legal_name,
  customer_tax_office = c.tax_office,
  customer_tax_number = c.tax_number,
  customer_address = c.address,
  customer_phone = c.phone,
  customer_email = c.email
from public.clients c
where p.client_id = c.id and p.customer_name is null;

alter table public.proformas drop constraint if exists proformas_customer_required;
alter table public.proformas add constraint proformas_customer_required
  check (client_id is not null or nullif(trim(customer_name), '') is not null);

drop function if exists public.create_standalone_proforma(uuid,date,date,public.currency_code,text,text,text,jsonb);

create or replace function public.create_standalone_proforma(
  p_client_id uuid,
  p_customer_name text,
  p_customer_legal_name text,
  p_customer_tax_office text,
  p_customer_tax_number text,
  p_customer_address text,
  p_customer_phone text,
  p_customer_email text,
  p_issue_date date,
  p_valid_until date,
  p_currency public.currency_code,
  p_bank_details text,
  p_description text,
  p_payment_terms text,
  p_items jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  new_id uuid; item jsonb; client_row public.clients%rowtype;
  subtotal_value numeric:=0; discount_value numeric:=0; vat_value numeric:=0; grand_value numeric:=0;
  line_base numeric; line_discount numeric; line_net_value numeric; line_vat_value numeric; position_value integer:=0;
begin
  if not public.has_permission('sales.manage') then raise exception 'insufficient_permission' using errcode='42501'; end if;
  if p_client_id is not null then
    select * into client_row from public.clients where id=p_client_id and status='active';
    if client_row.id is null then raise exception 'client_not_found'; end if;
    p_customer_name:=client_row.company_name; p_customer_legal_name:=client_row.legal_name;
    p_customer_tax_office:=client_row.tax_office; p_customer_tax_number:=client_row.tax_number;
    p_customer_address:=client_row.address; p_customer_phone:=client_row.phone; p_customer_email:=client_row.email;
  elsif nullif(trim(p_customer_name),'') is null then raise exception 'customer_name_required';
  end if;
  if jsonb_array_length(p_items)=0 then raise exception 'proforma_requires_items'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    line_base:=round((item->>'quantity')::numeric*(item->>'unit_price')::numeric,2);
    line_discount:=round(line_base*coalesce((item->>'discount_rate')::numeric,0)/100,2);
    line_net_value:=line_base-line_discount; line_vat_value:=round(line_net_value*coalesce((item->>'vat_rate')::numeric,0)/100,2);
    subtotal_value:=subtotal_value+line_base; discount_value:=discount_value+line_discount;
    vat_value:=vat_value+line_vat_value; grand_value:=grand_value+line_net_value+line_vat_value;
  end loop;
  insert into public.proformas(proforma_number,client_id,customer_name,customer_legal_name,customer_tax_office,customer_tax_number,customer_address,customer_phone,customer_email,issue_date,valid_until,currency,bank_details,description,payment_terms,subtotal,total_discount,total_vat,grand_total,created_by)
  values('PRF-'||extract(year from p_issue_date)::int||'-'||lpad(nextval('public.proforma_number_seq')::text,4,'0'),p_client_id,p_customer_name,p_customer_legal_name,p_customer_tax_office,p_customer_tax_number,p_customer_address,p_customer_phone,p_customer_email,p_issue_date,p_valid_until,p_currency,p_bank_details,p_description,p_payment_terms,subtotal_value,discount_value,vat_value,grand_value,auth.uid()) returning id into new_id;
  for item in select * from jsonb_array_elements(p_items) loop
    line_base:=round((item->>'quantity')::numeric*(item->>'unit_price')::numeric,2); line_discount:=round(line_base*coalesce((item->>'discount_rate')::numeric,0)/100,2);
    line_net_value:=line_base-line_discount; line_vat_value:=round(line_net_value*coalesce((item->>'vat_rate')::numeric,0)/100,2);
    insert into public.proforma_items(proforma_id,service_name,description,quantity,unit_price,discount_rate,vat_rate,line_net,line_vat,line_total,position)
    values(new_id,item->>'service_name',item->>'description',(item->>'quantity')::numeric,(item->>'unit_price')::numeric,coalesce((item->>'discount_rate')::numeric,0),coalesce((item->>'vat_rate')::numeric,0),line_net_value,line_vat_value,line_net_value+line_vat_value,position_value);
    position_value:=position_value+1;
  end loop; return new_id;
end $$;

grant execute on function public.create_standalone_proforma(uuid,text,text,text,text,text,text,text,date,date,public.currency_code,text,text,text,jsonb) to authenticated;
