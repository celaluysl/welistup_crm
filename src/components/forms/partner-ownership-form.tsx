"use client";
import { useActionState } from "react";
import { createPartnerOwnership } from "@/lib/actions/payroll";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
export function PartnerOwnershipForm({
  profiles,
}: {
  profiles: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createPartnerOwnership, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Ortak">
        <select name="profile_id" required className={inputClass}>
          <option value="">Seçin</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Ortaklık oranı (%)">
        <input
          name="ownership_percent"
          type="number"
          min="0.0001"
          max="100"
          step="0.0001"
          required
          className={inputClass}
        />
      </Field>
      <Field label="Geçerlilik başlangıcı">
        <input
          name="effective_from"
          type="date"
          required
          className={inputClass}
        />
      </Field>
      <Field label="Geçerlilik sonu">
        <input name="effective_to" type="date" className={inputClass} />
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
        <Button disabled={pending}>Oranı kaydet</Button>
      </div>
    </form>
  );
}
