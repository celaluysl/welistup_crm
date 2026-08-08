"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
type State = { error?: string; success?: string } | null;
export async function saveInvoiceTracking(
  _: State,
  fd: FormData,
): Promise<State> {
  const p = z
    .object({
      service_period_id: z.string().uuid(),
      status: z.enum([
        "waiting",
        "issued",
        "payment_pending",
        "partial",
        "paid",
      ]),
      invoice_number: z.string().optional(),
      invoice_date: z.string().optional(),
      due_date: z.string().optional(),
      notes: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Fatura bilgilerini kontrol edin." };
  const s = await createClient();
  const { error } = await s.rpc("upsert_invoice_tracking", {
    p_service_period_id: p.data.service_period_id,
    p_status: p.data.status,
    p_invoice_number: p.data.invoice_number || null,
    p_invoice_date: p.data.invoice_date || null,
    p_due_date: p.data.due_date || null,
    p_notes: p.data.notes || null,
  });
  if (error)
    return {
      error: error.message.includes("invoice_date_required")
        ? "Fatura kesildi durumunda fatura tarihi zorunludur."
        : error.message.includes("period_closed")
          ? "Kapalı dönemde fatura değiştirilemez."
          : error.message,
    };
  revalidatePath("/invoices");
  revalidatePath("/operations");
  return { success: "Fatura takibi güncellendi." };
}
