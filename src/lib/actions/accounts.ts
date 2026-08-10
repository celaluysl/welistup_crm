"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
type State = { error?: string; success?: string } | null;
export async function createAccount(_: State, fd: FormData): Promise<State> {
  const p = z
    .object({
      name: z.string().trim().min(2),
      account_type: z.enum(["bank", "cash", "virtual", "credit_card", "other"]),
      currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
      billing_preference: z.enum(["invoiced", "uninvoiced"]),
      opening_balance: z.coerce.number(),
      notes: z.string().trim().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Kasa bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { error } = await s
    .from("accounts")
    .insert({ ...p.data, created_by: user.id });
  if (error) return { error: error.message };
  revalidatePath("/accounts");
  return { success: "Kasa oluşturuldu." };
}
export async function updateAccount(_: State, fd: FormData): Promise<State> {
  const p = z
    .object({
      account_id: z.string().uuid(),
      name: z.string().trim().min(2),
      account_type: z.enum(["bank", "cash", "virtual", "credit_card", "other"]),
      currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
      billing_preference: z.enum(["invoiced", "uninvoiced"]),
      opening_balance: z.coerce.number(),
      status: z.enum(["active", "inactive"]),
      notes: z.string().trim().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Kasa bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { account_id, ...changes } = p.data;
  const { error } = await s
    .from("accounts")
    .update(changes)
    .eq("id", account_id);
  if (error) return { error: error.message };
  revalidatePath("/accounts");
  return { success: "Kasa bilgileri güncellendi." };
}
export async function createManualAccountMovement(
  _: State,
  fd: FormData,
): Promise<State> {
  const p = z
    .object({
      account_id: z.string().uuid(),
      movement_type: z.enum(["income", "expense"]),
      amount: z.coerce.number().positive(),
      date: z.string().date(),
      description: z.string().trim().min(2),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Hareket bilgilerini kontrol edin." };
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data: account } = await s
    .from("accounts")
    .select("currency")
    .eq("id", p.data.account_id)
    .eq("status", "active")
    .single();
  if (!account) return { error: "Aktif kasa bulunamadı." };
  const { error } = await s.from("finance_transactions").insert({
    account_id: p.data.account_id,
    transaction_date: p.data.date,
    transaction_type: p.data.movement_type,
    amount: p.data.movement_type === "income" ? p.data.amount : -p.data.amount,
    currency: account.currency,
    category:
      p.data.movement_type === "income"
        ? "Manuel para girişi"
        : "Manuel para çıkışı",
    description: p.data.description,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  return {
    success:
      p.data.movement_type === "income"
        ? "Para girişi kaydedildi."
        : "Para çıkışı kaydedildi.",
  };
}
export async function transferAccounts(_: State, fd: FormData): Promise<State> {
  const p = z
    .object({
      source: z.string().uuid(),
      target: z.string().uuid(),
      amount: z.coerce.number().positive(),
      date: z.string().date(),
      description: z.string().trim().min(2),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Transfer bilgilerini kontrol edin." };
  const s = await createClient();
  const { error } = await s.rpc("transfer_between_accounts", {
    p_source: p.data.source,
    p_target: p.data.target,
    p_amount: p.data.amount,
    p_date: p.data.date,
    p_description: p.data.description,
  });
  if (error)
    return {
      error: error.message.includes("currency_mismatch")
        ? "Kasaların para birimi aynı olmalı."
        : error.message,
    };
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  return { success: "Transfer çift taraflı olarak kaydedildi." };
}
