"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
type State = { error?: string; success?: string } | null;
export async function createSalaryConfig(
  _: State,
  fd: FormData,
): Promise<State> {
  const p = z
    .object({
      profile_id: z.string().uuid(),
      base_salary: z.coerce.number().min(0),
      currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
      effective_from: z.string().date(),
      notes: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Maaş bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { error } = await s
    .from("salary_configs")
    .insert({ ...p.data, created_by: user.id });
  if (error) return { error: error.message };
  revalidatePath("/payroll");
  return { success: "Maaş geçmişine yeni dönem eklendi." };
}
export async function generatePayroll(_: State, fd: FormData): Promise<State> {
  const p = z
    .object({
      year: z.coerce.number().int(),
      month: z.coerce.number().int().min(1).max(12),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Dönemi kontrol edin." };
  const s = await createClient();
  const { data, error } = await s.rpc("generate_payroll_periods", {
    p_year: p.data.year,
    p_month: p.data.month,
  });
  if (error) return { error: error.message };
  revalidatePath("/payroll");
  return { success: `${data ?? 0} maaş kaydı oluşturuldu.` };
}
export async function payPayroll(_: State, fd: FormData): Promise<State> {
  const p = z
    .object({
      payroll_id: z.string().uuid(),
      account_id: z.string().uuid(),
      amount: z.coerce.number().positive(),
      payment_date: z.string().date(),
      notes: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Ödeme bilgilerini kontrol edin." };
  const s = await createClient();
  const { error } = await s.rpc("pay_payroll", {
    p_payroll_id: p.data.payroll_id,
    p_account_id: p.data.account_id,
    p_amount: p.data.amount,
    p_payment_date: p.data.payment_date,
    p_notes: p.data.notes || null,
  });
  if (error)
    return {
      error: error.message.includes("period_closed")
        ? "Kapalı döneme ödeme işlenemez."
        : error.message,
    };
  revalidatePath("/payroll");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  return { success: "Maaş ödemesi kasaya işlendi." };
}
export async function goToPayrollPeriod(fd: FormData) {
  redirect(`/payroll?year=${fd.get("year")}&month=${fd.get("month")}`);
}
export async function createPartnerOwnership(
  _: State,
  fd: FormData,
): Promise<State> {
  const p = z
    .object({
      profile_id: z.string().uuid(),
      ownership_percent: z.coerce.number().positive().max(100),
      effective_from: z.string().date(),
      effective_to: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Ortaklık bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { error } = await s
    .from("partner_ownerships")
    .insert({
      ...p.data,
      effective_to: p.data.effective_to || null,
      created_by: user.id,
    });
  if (error) return { error: error.message };
  revalidatePath("/partners");
  return { success: "Ortaklık oranı geçmişe eklendi." };
}
