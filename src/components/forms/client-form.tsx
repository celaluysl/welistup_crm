"use client";
import { useActionState } from "react";
import { createClientAction } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

export function ClientForm() {
  const [state, action, pending] = useActionState(createClientAction, null);
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <Field label="Müşteri / şirket adı" className="sm:col-span-2">
        <input name="company_name" required className={inputClass} />
      </Field>
      <Field label="Şirket Ünvanı" className="sm:col-span-2">
        <input
          name="legal_name"
          required
          placeholder="Faturada kullanılacak resmi ünvan"
          className={inputClass}
        />
      </Field>
      <Field label="Kısa ad">
        <input name="short_name" className={inputClass} />
      </Field>
      <Field label="Müşteri tipi">
        <select name="client_type" className={inputClass}>
          <option value="direct">Direkt müşteri</option>
          <option value="agency">Ajans müşterisi</option>
          <option value="partner">Partner</option>
          <option value="other">Diğer</option>
        </select>
      </Field>
      <Field label="Yetkili kişi">
        <input name="contact_name" className={inputClass} />
      </Field>
      <Field label="Telefon">
        <input name="phone" className={inputClass} />
      </Field>
      <Field label="E-posta">
        <input name="email" type="email" className={inputClass} />
      </Field>
      <Field label="Vergi Dairesi">
        <input name="tax_office" className={inputClass} />
      </Field>
      <Field label="Vergi Numarası">
        <input name="tax_number" inputMode="numeric" className={inputClass} />
      </Field>
      <Field label="Adres" className="sm:col-span-2">
        <textarea
          name="address"
          rows={3}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      <Field label="Notlar" className="sm:col-span-2">
        <textarea
          name="notes"
          rows={4}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      {state?.error && (
        <div className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <div className="sm:col-span-2 flex justify-end">
        <Button disabled={pending}>
          {pending ? "Kaydediliyor…" : "Müşteriyi kaydet"}
        </Button>
      </div>
    </form>
  );
}
