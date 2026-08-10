create or replace function public.generate_recurring_manual_expenses(
  p_until date default (current_date + interval '60 days')::date
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  run_date date;
  month_last_day date;
  vat_amount numeric;
  created_count integer := 0;
begin
  for t in
    select *
    from public.manual_expense_templates
    where is_active and next_run_on <= p_until
    for update skip locked
  loop
    run_date := t.next_run_on;
    while run_date <= p_until and (t.ends_on is null or run_date <= t.ends_on) loop
      month_last_day := (date_trunc('month', run_date) + interval '1 month' - interval '1 day')::date;
      vat_amount := round(
        t.net_amount * case when t.billing_preference = 'invoiced' then t.vat_rate else 0 end / 100,
        2
      );

      insert into public.manual_expenses(
        template_id, name, category, year, month, net_amount, vat_rate,
        vat_amount, amount, currency, billing_preference, due_date, notes, created_by
      ) values (
        t.id,
        t.name,
        t.category,
        extract(year from run_date)::integer,
        extract(month from run_date)::integer,
        t.net_amount,
        case when t.billing_preference = 'invoiced' then t.vat_rate else 0 end,
        vat_amount,
        t.net_amount + vat_amount,
        t.currency,
        t.billing_preference,
        case
          when t.due_day is null then null
          else make_date(
            extract(year from run_date)::integer,
            extract(month from run_date)::integer,
            least(t.due_day, extract(day from month_last_day)::integer)
          )
        end,
        t.notes,
        t.created_by
      )
      on conflict(template_id, year, month) where template_id is not null do nothing;

      if found then created_count := created_count + 1; end if;
      run_date := (run_date + interval '1 month')::date;
    end loop;

    update public.manual_expense_templates
    set next_run_on = run_date,
        is_active = not (ends_on is not null and run_date > ends_on)
    where id = t.id;
  end loop;
  return created_count;
end;
$$;

revoke all on function public.generate_recurring_manual_expenses(date) from public;
grant execute on function public.generate_recurring_manual_expenses(date) to authenticated;

-- Önceki hatada şablonu oluşup aylık kayıtları yarım kalan giderleri tamamla.
select public.generate_recurring_manual_expenses(
  make_date(extract(year from current_date)::integer, 12, 31)
);
