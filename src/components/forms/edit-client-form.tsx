"use client";
import { useActionState } from "react";
import { updateClientAction } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
type Client = {
  id: string;
  company_name: string;
  legal_name: string | null;
  short_name: string | null;
  client_type: "direct" | "agency" | "partner" | "other";
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  tax_office: string | null;
  tax_number: string | null;
  address: string | null;
  notes: string | null;
};
export function EditClientForm({ client: c }: { client: Client }) {
  const [state, action, pending] = useActionState(updateClientAction, null);
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="id" value={c.id} />
      <Field label="Müşteri / şirket adı" className="sm:col-span-2">
        <input
          name="company_name"
          defaultValue={c.company_name}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Şirket Ünvanı" className="sm:col-span-2">
        <input
          name="legal_name"
          defaultValue={c.legal_name || c.company_name}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Kısa ad">
        <input
          name="short_name"
          defaultValue={c.short_name || ""}
          className={inputClass}
        />
      </Field>
      <Field label="Müşteri tipi">
        <select
          name="client_type"
          defaultValue={c.client_type}
          className={inputClass}
        >
          <option value="direct">Direkt müşteri</option>
          <option value="agency">Ajans müşterisi</option>
          <option value="partner">Partner</option>
          <option value="other">Diğer</option>
        </select>
      </Field>
      <Field label="Yetkili kişi">
        <input
          name="contact_name"
          defaultValue={c.contact_name || ""}
          className={inputClass}
        />
      </Field>
      <Field label="Telefon">
        <input
          name="phone"
          defaultValue={c.phone || ""}
          className={inputClass}
        />
      </Field>
      <Field label="E-posta">
        <input
          name="email"
          type="email"
          defaultValue={c.email || ""}
          className={inputClass}
        />
      </Field>
      <Field label="Vergi Dairesi">
        <input
          name="tax_office"
          defaultValue={c.tax_office || ""}
          className={inputClass}
        />
      </Field>
      <Field label="Vergi Numarası">
        <input
          name="tax_number"
          inputMode="numeric"
          defaultValue={c.tax_number || ""}
          className={inputClass}
        />
      </Field>
      <Field label="Adres" className="sm:col-span-2">
        <textarea
          name="address"
          rows={3}
          defaultValue={c.address || ""}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      <Field label="Notlar" className="sm:col-span-2">
        <textarea
          name="notes"
          rows={4}
          defaultValue={c.notes || ""}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      {state?.error && (
        <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>
      )}
      <div className="sm:col-span-2 flex justify-end">
        <Button disabled={pending}>
          {pending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
        </Button>
      </div>
    </form>
  );
}
