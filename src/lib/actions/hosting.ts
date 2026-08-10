"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
type State = { error?: string; success?: string } | null;
const schema = z.object({
  domain: z.string().trim().min(3),
  client_id: z.string().optional(),
  account_label: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]),
  is_paid: z.string().optional(),
  installation_date: z.string().optional(),
  next_payment_date: z.string().optional(),
  renewal_months: z.coerce.number().int().min(1).max(60),
  fee: z.coerce.number().min(0),
  currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
  notes: z.string().trim().optional(),
});
export async function saveHostingSubscription(
  _: State,
  fd: FormData,
): Promise<State> {
  const p = schema
    .extend({ subscription_id: z.string().uuid().optional() })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Sunucu takip bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const subscriptionId = p.data.subscription_id;
  const values = {
    domain: p.data.domain.toLocaleLowerCase("tr-TR"),
    client_id: p.data.client_id || null,
    account_label: p.data.account_label || null,
    status: p.data.status,
    is_paid: p.data.is_paid === "on",
    installation_date: p.data.installation_date || null,
    next_payment_date: p.data.next_payment_date || null,
    renewal_months: p.data.renewal_months,
    fee: p.data.fee,
    currency: p.data.currency,
    notes: p.data.notes || null,
  };
  const result = subscriptionId
    ? await s
        .from("hosting_subscriptions")
        .update(values)
        .eq("id", subscriptionId)
    : await s
        .from("hosting_subscriptions")
        .insert({ ...values, created_by: user.id });
  if (result.error) return { error: result.error.message };
  await s.rpc("generate_hosting_receivables");
  revalidatePath("/hosting");
  revalidatePath("/collections");
  return { success: "Sunucu takip kaydı kaydedildi." };
}
export async function classifyHostingReceivable(
  _: State,
  fd: FormData,
): Promise<State> {
  const p = z
    .object({
      receivable_id: z.string().uuid(),
      billing_preference: z.enum(["invoiced", "uninvoiced"]),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Faturalama türünü seçin." };
  const s = await createClient();
  const { error } = await s.rpc("classify_hosting_receivable", {
    p_receivable_id: p.data.receivable_id,
    p_billing: p.data.billing_preference,
  });
  if (error) return { error: error.message };
  revalidatePath("/collections");
  return { success: "Sunucu alacağı onaylandı." };
}
export async function payHostingReceivable(
  _: State,
  fd: FormData,
): Promise<State> {
  const p = z
    .object({
      receivable_id: z.string().uuid(),
      account_id: z.string().uuid(),
      amount: z.coerce.number().positive(),
      payment_date: z.string().date(),
      notes: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Tahsilat bilgilerini kontrol edin." };
  const s = await createClient();
  const { error } = await s.rpc("pay_hosting_receivable", {
    p_receivable_id: p.data.receivable_id,
    p_account_id: p.data.account_id,
    p_amount: p.data.amount,
    p_payment_date: p.data.payment_date,
    p_notes: p.data.notes || null,
  });
  if (error)
    return {
      error: error.message.includes("billing_preference_mismatch")
        ? "Faturalama türüne uygun tahsilat kasasını seçin."
        : error.message,
    };
  revalidatePath("/collections");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  return { success: "Sunucu tahsilatı kaydedildi." };
}
