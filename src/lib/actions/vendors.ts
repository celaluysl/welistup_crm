"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string; success?: string } | null;
const vendorSchema = z.object({
  name: z.string().trim().min(2),
  vendor_type: z.enum([
    "freelancer",
    "agency",
    "company",
    "developer",
    "designer",
    "content_creator",
    "other",
  ]),
  phone: z.string().optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  tax_office: z.string().optional(),
  tax_number: z.string().optional(),
  bank_details: z.string().optional(),
  notes: z.string().optional(),
});
export async function createVendor(_: State, fd: FormData): Promise<State> {
  const p = vendorSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Tedarikçi bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data, error } = await s
    .from("vendors")
    .insert({ ...p.data, email: p.data.email || null, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/vendors");
  redirect(`/vendors/${data.id}`);
}
export async function createVendorAssignment(
  _: State,
  fd: FormData,
): Promise<State> {
  const p = z
    .object({
      vendor_id: z.string().uuid(),
      project_service_id: z.string().uuid(),
      start_date: z.string().date(),
      end_date: z.string().optional(),
      default_amount: z.coerce.number().min(0),
      payment_model: z.enum(["monthly_fixed", "monthly_variable", "one_time"]),
      billing_preference: z.enum(["invoiced", "uninvoiced"]),
      vat_rate: z.coerce.number().min(0).max(100),
      payment_day: z.coerce.number().int().min(1).max(31),
      currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
      notes: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Atama bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { error } = await s.from("vendor_assignments").insert({
    ...p.data,
    end_date: p.data.end_date || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/vendors/${p.data.vendor_id}`);
  return { success: "Proje hizmeti atandı." };
}
export async function updateVendorAssignment(
  _: State,
  fd: FormData,
): Promise<State> {
  const p = z
    .object({
      assignment_id: z.string().uuid(),
      vendor_id: z.string().uuid(),
      project_service_id: z.string().uuid(),
      start_date: z.string().date(),
      end_date: z.string().optional(),
      default_amount: z.coerce.number().min(0),
      payment_model: z.enum(["monthly_fixed", "monthly_variable", "one_time"]),
      billing_preference: z.enum(["invoiced", "uninvoiced"]),
      vat_rate: z.coerce.number().min(0).max(100),
      payment_day: z.coerce.number().int().min(1).max(31),
      currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
      status: z.enum(["active", "inactive"]),
      notes: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Atama bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { assignment_id, vendor_id } = p.data;
  const changes = {
    start_date: p.data.start_date,
    end_date: p.data.end_date,
    default_amount: p.data.default_amount,
    payment_model: p.data.payment_model,
    billing_preference: p.data.billing_preference,
    vat_rate: p.data.vat_rate,
    payment_day: p.data.payment_day,
    currency: p.data.currency,
    status: p.data.status,
    notes: p.data.notes,
  };
  const { error } = await s
    .from("vendor_assignments")
    .update({
      ...changes,
      end_date: changes.end_date || null,
      vat_rate:
        changes.billing_preference === "invoiced" ? changes.vat_rate : 0,
    })
    .eq("id", assignment_id)
    .eq("vendor_id", vendor_id);
  if (error) return { error: error.message };
  revalidatePath(`/vendors/${vendor_id}`);
  revalidatePath("/vendor-payments");
  return { success: "Atama güncellendi." };
}
export async function updateVendorAccrualAmount(
  _: State,
  fd: FormData,
): Promise<State> {
  const p = z
    .object({
      accrual_id: z.string().uuid(),
      net_amount: z.coerce.number().min(0),
      notes: z.string().trim().min(2),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success)
    return { error: "Hakediş tutarı ve açıklamasını kontrol edin." };
  const s = await createClient();
  const { error } = await s.rpc("update_vendor_accrual_amount", {
    p_accrual_id: p.data.accrual_id,
    p_net_amount: p.data.net_amount,
    p_notes: p.data.notes,
  });
  if (error)
    return {
      error: error.message.includes("accrual_has_payments")
        ? "Ödeme yapılmış hakediş değiştirilemez."
        : error.message,
    };
  revalidatePath("/vendor-payments");
  revalidatePath("/expenses");
  return { success: "Aylık hakediş onaylandı." };
}
export async function generateVendorAccruals(
  _: State,
  fd: FormData,
): Promise<State> {
  const p = z
    .object({
      year: z.coerce.number().int().min(2000).max(2200),
      month: z.coerce.number().int().min(1).max(12),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Dönemi kontrol edin." };
  const s = await createClient();
  const { data, error } = await s.rpc("generate_vendor_accruals", {
    p_year: p.data.year,
    p_month: p.data.month,
  });
  if (error) return { error: error.message };
  revalidatePath("/vendor-payments");
  revalidatePath("/expenses");
  return { success: `${data ?? 0} hakediş oluşturuldu.` };
}

export async function payVendorAccrual(_: State, fd: FormData): Promise<State> {
  const p = z
    .object({
      accrual_id: z.string().uuid(),
      account_id: z.string().uuid(),
      amount: z.coerce.number().positive(),
      payment_date: z.string().date(),
      notes: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Ödeme bilgilerini kontrol edin." };
  const s = await createClient();
  const { error } = await s.rpc("pay_vendor_accrual", {
    p_accrual_id: p.data.accrual_id,
    p_account_id: p.data.account_id,
    p_amount: p.data.amount,
    p_payment_date: p.data.payment_date,
    p_notes: p.data.notes || null,
  });
  if (error)
    return {
      error: error.message.includes("invalid_payment_amount")
        ? "Tutar kalan hakedişten büyük olamaz."
        : error.message.includes("currency_mismatch")
          ? "Kasa ve hakediş para birimi aynı olmalı."
          : error.message.includes("billing_preference_mismatch")
            ? "Faturalı/faturasız durumuna uygun gider kasasını seçin."
            : error.message.includes("amount_review_required")
              ? "Ödeme öncesinde bu ayın hakediş tutarını onaylayın."
              : error.message,
    };
  revalidatePath("/vendor-payments");
  revalidatePath("/expenses");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  return { success: "Tedarikçi ödemesi ve kasa hareketi kaydedildi." };
}
