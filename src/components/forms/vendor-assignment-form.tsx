"use client";
import { useActionState, useState } from "react";
import { createVendorAssignment } from "@/lib/actions/vendors";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
type Service = { id: string; label: string; currency: string };
export function VendorAssignmentForm({
  vendorId,
  services,
}: {
  vendorId: string;
  services: Service[];
}) {
  const [state, action, pending] = useActionState(createVendorAssignment, null);
  const [paymentModel, setPaymentModel] = useState("monthly_fixed");
  const [billing, setBilling] = useState("uninvoiced");
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="vendor_id" value={vendorId} />
      <Field label="Proje hizmeti" className="sm:col-span-2">
        <select name="project_service_id" required className={inputClass}>
          <option value="">Seçin</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Başlangıç">
        <input
          name="start_date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className={inputClass}
        />
      </Field>
      <Field label="Bitiş">
        <input name="end_date" type="date" className={inputClass} />
      </Field>
      <Field label="Ödeme modeli">
        <select
          name="payment_model"
          value={paymentModel}
          onChange={(event) => setPaymentModel(event.target.value)}
          className={inputClass}
        >
          <option value="monthly_fixed">Aylık sabit</option>
          <option value="monthly_variable">Aylık değişken</option>
          <option value="one_time">Tek seferlik</option>
        </select>
      </Field>
      <Field
        label={
          paymentModel === "monthly_variable"
            ? "Başlangıç tahmini (opsiyonel)"
            : "Net hakediş"
        }
      >
        <input
          name="default_amount"
          type="number"
          min="0"
          step="0.01"
          required={paymentModel !== "monthly_variable"}
          defaultValue={paymentModel === "monthly_variable" ? 0 : undefined}
          className={inputClass}
        />
      </Field>
      <Field label="Ödeme şekli">
        <select
          name="billing_preference"
          value={billing}
          onChange={(event) => setBilling(event.target.value)}
          className={inputClass}
        >
          <option value="uninvoiced">Faturasız</option>
          <option value="invoiced">Faturalı</option>
        </select>
      </Field>
      <Field label="KDV (%)">
        <input
          name="vat_rate"
          type="number"
          min="0"
          max="100"
          step="0.01"
          defaultValue="20"
          disabled={billing !== "invoiced"}
          className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
        />
        {billing !== "invoiced" && (
          <input type="hidden" name="vat_rate" value="0" />
        )}
      </Field>
      <Field label="Ödeme günü">
        <input
          name="payment_day"
          type="number"
          min="1"
          max="31"
          defaultValue="28"
          required
          className={inputClass}
        />
      </Field>
      <Field label="Para birimi">
        <select name="currency" className={inputClass}>
          {["TRY", "USD", "EUR", "GBP"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field label="Not" className="sm:col-span-2">
        <textarea
          name="notes"
          rows={2}
          className={`${inputClass} h-auto py-2`}
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
          {pending ? "Atanıyor…" : "Hizmete ata"}
        </Button>
      </div>
    </form>
  );
}
