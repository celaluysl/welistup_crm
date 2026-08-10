alter table public.manual_expense_templates
  add column if not exists status public.record_status not null default 'active',
  add column if not exists is_recurring boolean not null default true;

create index if not exists manual_expense_templates_status_idx
  on public.manual_expense_templates(billing_preference,status,name);

-- Daha önce tek seferlik oluşturulan giderleri de kalıcı gider kalemine dönüştür.
-- Aylık kayıt kaldırıldığında bu tanım korunur ve başka bir ay tekrar kullanılabilir.
do $$
declare
  expense_row record;
  definition_id uuid;
begin
  for expense_row in
    select *
    from public.manual_expenses
    where template_id is null
    order by created_at
  loop
    insert into public.manual_expense_templates(
      name,category,net_amount,vat_rate,currency,billing_preference,due_day,
      starts_on,next_run_on,notes,is_active,is_recurring,status,created_by
    ) values (
      expense_row.name,
      expense_row.category,
      expense_row.net_amount,
      expense_row.vat_rate,
      expense_row.currency,
      expense_row.billing_preference,
      case when expense_row.due_date is null then null else extract(day from expense_row.due_date)::integer end,
      make_date(expense_row.year,expense_row.month,1),
      (make_date(expense_row.year,expense_row.month,1)+interval '1 month')::date,
      expense_row.notes,
      false,
      false,
      'active',
      expense_row.created_by
    ) returning id into definition_id;

    update public.manual_expenses
    set template_id=definition_id
    where id=expense_row.id;
  end loop;
end$$;

-- Pasife veya arşive alınan kalemlerin otomatik aylık üretimini durdur.
create or replace function public.sync_manual_expense_template_activity()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status<>'active' then
    new.is_active:=false;
  elsif new.is_recurring then
    new.is_active:=true;
  end if;
  return new;
end$$;

drop trigger if exists sync_manual_expense_template_activity on public.manual_expense_templates;
create trigger sync_manual_expense_template_activity
before insert or update of status,is_recurring on public.manual_expense_templates
for each row execute function public.sync_manual_expense_template_activity();
