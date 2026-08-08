"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
type State = { error?: string; success?: string } | null;
export async function initializeMonthClose(year: number, month: number) {
  const s = await createClient();
  const { data, error } = await s.rpc("initialize_month_close", {
    p_year: year,
    p_month: month,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/month-close/${year}/${month}`);
  return data;
}
export async function startMonthClose(fd: FormData) {
  const year = Number(fd.get("year")),
    month = Number(fd.get("month"));
  await initializeMonthClose(year, month);
  redirect(`/month-close/${year}/${month}`);
}
export async function setChecklistItem(
  id: string,
  closeId: string,
  year: number,
  month: number,
  fd: FormData,
) {
  const s = await createClient();
  const checked = fd.get("completed") === "on";
  const {
    data: { user },
  } = await s.auth.getUser();
  const { error } = await s
    .from("month_close_checklist")
    .update({
      is_completed: checked,
      completed_by: checked ? user?.id : null,
      completed_at: checked ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("month_close_id", closeId);
  if (error) throw new Error(error.message);
  revalidatePath(`/month-close/${year}/${month}`);
}
export async function closeMonth(_: State, fd: FormData): Promise<State> {
  const p = z
    .object({
      close_id: z.string().uuid(),
      year: z.coerce.number().int(),
      month: z.coerce.number().int(),
      reserve: z.coerce.number().min(0),
      notes: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Kapanış bilgilerini kontrol edin." };
  const s = await createClient();
  const { error } = await s.rpc("close_month", {
    p_close_id: p.data.close_id,
    p_reserve: p.data.reserve,
    p_notes: p.data.notes || null,
  });
  if (error)
    return {
      error: error.message.includes("checklist_incomplete")
        ? "Ayı kapatmadan önce tüm checklist maddelerini tamamlayın."
        : error.message.includes("ownership_total")
          ? "Ortaklık oranlarının toplamı %100 olmalı."
          : error.message,
    };
  revalidatePath(`/month-close/${p.data.year}/${p.data.month}`);
  return { success: "Ay kapatıldı ve finansal snapshot oluşturuldu." };
}
export async function reopenMonth(
  closeId: string,
  year: number,
  month: number,
) {
  const s = await createClient();
  const { error } = await s.rpc("reopen_month", { p_close_id: closeId });
  if (error) throw new Error(error.message);
  revalidatePath(`/month-close/${year}/${month}`);
}
export async function goToMonthClose(fd: FormData) {
  redirect(`/month-close/${fd.get("year")}/${fd.get("month")}`);
}
