"use client";
import { useActionState } from "react";
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
      <Field label="Aylık varsayılan hakediş">
        <input
          name="default_amount"
          type="number"
          min="0"
          step="0.01"
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
