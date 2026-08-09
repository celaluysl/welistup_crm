"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string; success?: string } | null;

export async function generateMonthlyPeriods(
  _: State,
  formData: FormData,
): Promise<State> {
  const parsed = z
    .object({
      year: z.coerce.number().int().min(2000).max(2200),
      month: z.coerce.number().int().min(1).max(12),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Dönem bilgisini kontrol edin." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_service_periods", {
    p_year: parsed.data.year,
    p_month: parsed.data.month,
  });
  if (error) return { error: error.message };
  revalidatePath(`/operations/${parsed.data.year}/${parsed.data.month}`);
  return { success: `${data ?? 0} yeni hizmet dönemi oluşturuldu.` };
}

export async function generateYearPeriods(
  _: State,
  formData: FormData,
): Promise<State> {
  const parsed = z.coerce.number().int().min(2000).max(2200).safeParse(formData.get("year"));
  if (!parsed.success) return { error: "Yıl bilgisini kontrol edin." };
  const supabase = await createClient();
  let created = 0;
  for (let month = 1; month <= 12; month += 1) {
    const { data, error } = await supabase.rpc("generate_service_periods", { p_year: parsed.data, p_month: month });
    if (error) return { error: error.message };
    created += Number(data || 0);
  }
  revalidatePath("/collections");
  return { success: `${created} yeni aylık tahsilat kaydı oluşturuldu.` };
}

export async function recordPayment(
  _: State,
  formData: FormData,
): Promise<State> {
  const parsed = z
    .object({
      receivable_id: z.string().uuid(),
      account_id: z.string().uuid(),
      amount: z.coerce.number().positive(),
      payment_date: z.string().date(),
      notes: z.string().trim().max(1000).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ödeme bilgilerini kontrol edin." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_receivable_payment_to_account", {
    p_receivable_id: parsed.data.receivable_id,
    p_account_id: parsed.data.account_id,
    p_amount: parsed.data.amount,
    p_payment_date: parsed.data.payment_date,
    p_notes: parsed.data.notes || null,
  });
  if (error)
    return {
      error: error.message.includes("invalid_payment_amount")
        ? "Tutar kalan bakiyeden büyük olamaz."
        : error.message.includes("currency_mismatch")
          ? "Seçilen kasanın para birimi alacak ile aynı olmalı."
          : error.message,
    };
  revalidatePath("/collections");
  revalidatePath(`/collections/${parsed.data.receivable_id}`);
  return { success: "Ödeme kaydedildi." };
}

export async function updatePayment(
  _: State,
  formData: FormData,
): Promise<State> {
  const parsed = z.object({
    payment_id: z.string().uuid(),
    account_id: z.string().uuid(),
    amount: z.coerce.number().positive(),
    payment_date: z.string().date(),
    notes: z.string().trim().max(1000).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ödeme bilgilerini kontrol edin." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_receivable_payment", {
    p_payment_id: parsed.data.payment_id,
    p_account_id: parsed.data.account_id,
    p_amount: parsed.data.amount,
    p_payment_date: parsed.data.payment_date,
    p_notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message.includes("invalid_payment_amount") ? "Tutar toplam alacağı aşamaz." : error.message.includes("currency_mismatch") ? "Seçilen kasanın para birimi ödeme ile aynı olmalı." : error.message };
  revalidatePath("/collections");
  return { success: "Ödeme güncellendi." };
}

export async function addCollectionActivity(
  _: State,
  formData: FormData,
): Promise<State> {
  const parsed = z
    .object({
      receivable_id: z.string().uuid(),
      activity_type: z.enum(["call", "whatsapp", "email", "promise", "note"]),
      note: z.string().trim().min(2).max(2000),
      promised_payment_date: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Aktivite bilgilerini kontrol edin." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { error } = await supabase.from("collection_activities").insert({
    receivable_id: parsed.data.receivable_id,
    activity_type: parsed.data.activity_type,
    note: parsed.data.note,
    promised_payment_date: parsed.data.promised_payment_date || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/collections/${parsed.data.receivable_id}`);
  return { success: "Aktivite kaydedildi." };
}

export async function goToPeriod(formData: FormData) {
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2200 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  )
    redirect(`/operations/${year}/${month}`);
}
