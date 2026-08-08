"use client";
import { useActionState } from "react";
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
  return (
    <form
      action={action}
      className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
    >
      <input type="hidden" name="service_period_id" value={periodId} />
      <Field label="Fatura durumu">
        <select
          name="status"
          defaultValue={invoice?.status || "waiting"}
          className={inputClass}
        >
          <option value="waiting">Fatura bekliyor</option>
          <option value="issued">Fatura kesildi</option>
          <option value="payment_pending">Ödeme bekleniyor</option>
          <option value="partial">Kısmi ödeme</option>
          <option value="paid">Ödendi</option>
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
          {pending ? "Kaydediliyor…" : "Fatura takibini kaydet"}
        </Button>
      </div>
    </form>
  );
}
