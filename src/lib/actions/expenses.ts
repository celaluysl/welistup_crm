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
  const { error } = await s
    .from("manual_expenses")
    .insert({
      ...parsed.data,
      vat_rate: vat,
      vat_amount: vatAmount,
      amount: parsed.data.net_amount + vatAmount,
      due_date: parsed.data.due_date || null,
      notes: parsed.data.notes || null,
      created_by: user.id,
    });
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { success: "Gider kaydedildi." };
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
