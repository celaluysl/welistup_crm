"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string; success?: string } | null;

export async function createManualExpense(
  _: State,
  fd: FormData,
): Promise<State> {
  const parsed = z
    .object({
      name: z.string().trim().min(2),
      category: z.string().trim().min(2),
      year: z.coerce.number().int().min(2000).max(2200),
      month: z.coerce.number().int().min(1).max(12),
      net_amount: z.coerce.number().min(0),
      vat_rate: z.coerce.number().min(0).max(100),
      currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
      billing_preference: z.enum(["invoiced", "uninvoiced"]),
      due_date: z.string().optional(),
      notes: z.string().trim().optional(),
      recurrence: z.enum(["one_time", "monthly"]),
      ends_on: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Gider bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const vat =
    parsed.data.billing_preference === "invoiced" ? parsed.data.vat_rate : 0;
  const vatAmount = Math.round(parsed.data.net_amount * vat) / 100;
  const expense = {
    name: parsed.data.name,
    category: parsed.data.category,
    year: parsed.data.year,
    month: parsed.data.month,
    net_amount: parsed.data.net_amount,
    currency: parsed.data.currency,
    billing_preference: parsed.data.billing_preference,
    vat_rate: vat,
    vat_amount: vatAmount,
    amount: parsed.data.net_amount + vatAmount,
    due_date: parsed.data.due_date || null,
    notes: parsed.data.notes || null,
    created_by: user.id,
  };
  const startsOn = `${parsed.data.year}-${String(parsed.data.month).padStart(2, "0")}-01`;
  const nextRun = new Date(`${startsOn}T12:00:00`);
  if (parsed.data.recurrence === "one_time") nextRun.setMonth(nextRun.getMonth() + 1);
  const { data: template, error: templateError } = await s
    .from("manual_expense_templates")
    .insert({
        name: parsed.data.name,
        category: parsed.data.category,
        net_amount: parsed.data.net_amount,
        vat_rate: vat,
        currency: parsed.data.currency,
        billing_preference: parsed.data.billing_preference,
        due_day: parsed.data.due_date
          ? Number(parsed.data.due_date.slice(-2))
          : null,
        starts_on: startsOn,
        ends_on: parsed.data.ends_on || null,
        next_run_on:
          parsed.data.recurrence === "monthly"
            ? startsOn
            : nextRun.toISOString().slice(0, 10),
        notes: parsed.data.notes || null,
        is_active: parsed.data.recurrence === "monthly",
        is_recurring: parsed.data.recurrence === "monthly",
        status: "active",
        created_by: user.id,
      })
      .select("id")
      .single();
  if (templateError || !template)
    return { error: templateError?.message || "Gider kalemi oluşturulamadı." };
  let error;
  if (parsed.data.recurrence === "monthly") {
      const generated = await s.rpc("generate_recurring_manual_expenses", {
        p_until: `${parsed.data.year}-12-31`,
      });
      error = generated.error;
  } else {
    ({ error } = await s
      .from("manual_expenses")
      .insert({ ...expense, template_id: template.id }));
  }
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: "Gider kaydedildi." };
}

export async function updateManualExpense(
  _: State,
  fd: FormData,
): Promise<State> {
  const parsed = z
    .object({
      expense_id: z.string().uuid(),
      name: z.string().trim().min(2),
      category: z.string().trim().min(2),
      net_amount: z.coerce.number().min(0),
      vat_rate: z.coerce.number().min(0).max(100),
      due_date: z.string().optional(),
      notes: z.string().trim().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Gider bilgilerini kontrol edin." };
  const s = await createClient();
  const { data: current, error: readError } = await s
    .from("manual_expenses")
    .select("billing_preference,manual_expense_payments(amount)")
    .eq("id", parsed.data.expense_id)
    .single();
  if (readError || !current)
    return { error: readError?.message || "Gider bulunamadı." };
  const vat =
    current.billing_preference === "invoiced" ? parsed.data.vat_rate : 0;
  const vatAmount = Math.round(parsed.data.net_amount * vat) / 100;
  const total = parsed.data.net_amount + vatAmount;
  const paid =
    (current.manual_expense_payments as { amount: number }[] | null)?.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    ) || 0;
  if (total < paid)
    return { error: "Toplam gider, ödenmiş tutardan düşük olamaz." };
  const { error } = await s
    .from("manual_expenses")
    .update({
      name: parsed.data.name,
      category: parsed.data.category,
      net_amount: parsed.data.net_amount,
      vat_rate: vat,
      vat_amount: vatAmount,
      amount: total,
      due_date: parsed.data.due_date || null,
      notes: parsed.data.notes || null,
      status: paid >= total ? "paid" : paid > 0 ? "partial" : "pending",
    })
    .eq("id", parsed.data.expense_id);
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: "Bu aya ait gider güncellendi." };
}

export async function addManualExpenseMonth(
  _: State,
  fd: FormData,
): Promise<State> {
  const parsed = z
    .object({
      definition_id: z.string().uuid(),
      year: z.coerce.number().int().min(2000).max(2200),
      month: z.coerce.number().int().min(1).max(12),
      net_amount: z.coerce.number().min(0),
      vat_rate: z.coerce.number().min(0).max(100),
      due_date: z.string().optional(),
      notes: z.string().trim().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Ay ve gider bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data: source, error: sourceError } = await s
    .from("manual_expense_templates")
    .select("id,name,category,currency,billing_preference")
    .eq("id", parsed.data.definition_id)
    .single();
  if (sourceError || !source)
    return { error: sourceError?.message || "Kaynak gider bulunamadı." };

  const vat = source.billing_preference === "invoiced" ? parsed.data.vat_rate : 0;
  const vatAmount = Math.round(parsed.data.net_amount * vat) / 100;
  const { error } = await s.from("manual_expenses").insert({
    template_id: source.id,
    name: source.name,
    category: source.category,
    year: parsed.data.year,
    month: parsed.data.month,
    net_amount: parsed.data.net_amount,
    vat_rate: vat,
    vat_amount: vatAmount,
    amount: parsed.data.net_amount + vatAmount,
    currency: source.currency,
    billing_preference: source.billing_preference,
    due_date: parsed.data.due_date || null,
    notes: parsed.data.notes || null,
    created_by: user.id,
  });
  if (error)
    return {
      error: error.code === "23505" ? "Bu gider ilgili ayda zaten bulunuyor." : error.message,
    };
  revalidatePath("/expenses");
  return { success: "Gider seçilen aya eklendi." };
}

export async function removeManualExpenseMonth(
  _: State,
  fd: FormData,
): Promise<State> {
  const parsed = z.object({ expense_id: z.string().uuid() }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Gider kaydı geçersiz." };
  const s = await createClient();
  const { count, error: paymentError } = await s
    .from("manual_expense_payments")
    .select("id", { count: "exact", head: true })
    .eq("manual_expense_id", parsed.data.expense_id);
  if (paymentError) return { error: paymentError.message };
  if ((count || 0) > 0)
    return { error: "Ödeme işlenmiş bir gider ay kaydı kaldırılamaz." };
  const { error } = await s.from("manual_expenses").delete().eq("id", parsed.data.expense_id);
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: "Gider yalnızca bu aydan kaldırıldı." };
}

export async function updateManualExpenseDefinition(
  _: State,
  fd: FormData,
): Promise<State> {
  const parsed = z
    .object({
      definition_id: z.string().uuid(),
      name: z.string().trim().min(2),
      category: z.string().trim().min(2),
      status: z.enum(["active", "inactive", "archived"]),
      is_recurring: z.enum(["true", "false"]),
      notes: z.string().trim().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Gider kalemi bilgilerini kontrol edin." };
  const s = await createClient();
  const nextMonth = new Date();
  nextMonth.setDate(1);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const { error } = await s
    .from("manual_expense_templates")
    .update({
      name: parsed.data.name,
      category: parsed.data.category,
      status: parsed.data.status,
      is_recurring: parsed.data.is_recurring === "true",
      ...(
        parsed.data.status === "active" && parsed.data.is_recurring === "true"
          ? { next_run_on: nextMonth.toISOString().slice(0, 10) }
          : {}
      ),
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.definition_id);
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: "Gider kalemi güncellendi." };
}

export async function repeatManualExpense(
  _: State,
  fd: FormData,
): Promise<State> {
  const parsed = z
    .object({
      expense_id: z.string().uuid(),
      ends_on: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Tekrarlama bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data: expense, error: readError } = await s
    .from("manual_expenses")
    .select("*")
    .eq("id", parsed.data.expense_id)
    .single();
  if (readError || !expense)
    return { error: readError?.message || "Gider bulunamadı." };
  if (expense.template_id)
    return { error: "Bu gider zaten aylık tekrarlanıyor." };
  const startsOn = `${expense.year}-${String(expense.month).padStart(2, "0")}-01`;
  const nextRun = new Date(`${startsOn}T12:00:00`);
  nextRun.setMonth(nextRun.getMonth() + 1);
  const { data: template, error: templateError } = await s
    .from("manual_expense_templates")
    .insert({
      name: expense.name,
      category: expense.category,
      net_amount: expense.net_amount,
      vat_rate: expense.vat_rate,
      currency: expense.currency,
      billing_preference: expense.billing_preference,
      due_day: expense.due_date
        ? Number(String(expense.due_date).slice(-2))
        : null,
      starts_on: startsOn,
      ends_on: parsed.data.ends_on || null,
      next_run_on: nextRun.toISOString().slice(0, 10),
      notes: expense.notes,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (templateError || !template)
    return { error: templateError?.message || "Şablon oluşturulamadı." };
  const linked = await s
    .from("manual_expenses")
    .update({ template_id: template.id })
    .eq("id", expense.id);
  if (linked.error) return { error: linked.error.message };
  const generated = await s.rpc("generate_recurring_manual_expenses", {
    p_until: `${expense.year}-12-31`,
  });
  if (generated.error)
    return {
      error: generated.error.message.includes("interval")
        ? "Aylık tarih hesaplanamadı. Lütfen tekrar deneyin."
        : generated.error.message,
    };
  revalidatePath("/expenses");
  return { success: "Gider sonraki aylarda tekrarlanacak." };
}

export async function payManualExpense(_: State, fd: FormData): Promise<State> {
  const parsed = z
    .object({
      expense_id: z.string().uuid(),
      account_id: z.string().uuid(),
      amount: z.coerce.number().positive(),
      payment_date: z.string().date(),
      notes: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Ödeme bilgilerini kontrol edin." };
  const s = await createClient();
  const { error } = await s.rpc("pay_manual_expense", {
    p_expense_id: parsed.data.expense_id,
    p_account_id: parsed.data.account_id,
    p_amount: parsed.data.amount,
    p_payment_date: parsed.data.payment_date,
    p_notes: parsed.data.notes || null,
  });
  if (error)
    return {
      error: error.message.includes("billing_preference_mismatch")
        ? "Gider türüne uygun kasayı seçin."
        : error.message.includes("invalid_payment_amount")
          ? "Tutar kalan giderden büyük olamaz."
          : error.message,
    };
  revalidatePath("/expenses");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  return { success: "Gider ödemesi kasaya işlendi." };
}
