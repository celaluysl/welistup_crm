"use client";
import { useActionState, useState } from "react";
import { saveInvoiceTracking } from "@/lib/actions/invoices";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
type Invoice = {
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  status?: string;
  notes?: string | null;
} | null;
export function InvoiceTrackingForm({
  periodId,
  invoice,
  defaultDueDate,
}: {
  periodId: string;
  invoice: Invoice;
  defaultDueDate: string | null;
}) {
  const [state, action, pending] = useActionState(saveInvoiceTracking, null);
  const [status, setStatus] = useState(invoice?.status || "waiting");
  return (
    <form
      action={action}
      className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
    >
      <input type="hidden" name="service_period_id" value={periodId} />
      <Field label="Fatura durumu">
        <select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={inputClass}
        >
          <option value="waiting">Fatura bekliyor</option>
          <option value="issued">Fatura kesildi</option>
          <option value="payment_pending">Ödeme bekleniyor</option>
          <option value="partial">Kısmi ödeme</option>
          <option value="paid">Ödendi</option>
          <option value="cancelled">Fatura iptal edildi</option>
        </select>
      </Field>
      <Field label="Fatura numarası">
        <input
          name="invoice_number"
          defaultValue={invoice?.invoice_number || ""}
          className={inputClass}
        />
      </Field>
      <Field label="Fatura tarihi">
        <input
          name="invoice_date"
          type="date"
          defaultValue={invoice?.invoice_date || ""}
          className={inputClass}
        />
      </Field>
      <Field label="Vade">
        <input
          name="due_date"
          type="date"
          defaultValue={invoice?.due_date || defaultDueDate || ""}
          className={inputClass}
        />
      </Field>
      <Field label="Not" className="sm:col-span-2">
        <input
          name="notes"
          defaultValue={invoice?.notes || ""}
          className={inputClass}
        />
      </Field>
      {status === "cancelled" && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 sm:col-span-2">İptal nedenini not alanına yazın. Fatura iptal edilir ancak müşterinin alacağı silinmez; gerekiyorsa yeni fatura kesilebilir.</div>}
      {state?.success && (
        <p className="sm:col-span-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      {state?.error && (
        <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>
      )}
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Kaydediliyor…" : status === "cancelled" ? "Fatura iptalini kaydet" : "Fatura takibini kaydet"}
        </Button>
      </div>
    </form>
  );
}
