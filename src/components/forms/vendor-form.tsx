"use client";
import { useActionState } from "react";
import { createVendor } from "@/lib/actions/vendors";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
export function VendorForm() {
  const [state, action, pending] = useActionState(createVendor, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Ad / şirket adı">
        <input name="name" required className={inputClass} />
      </Field>
      <Field label="Tedarikçi türü">
        <select name="vendor_type" className={inputClass}>
          <option value="freelancer">Freelancer</option>
          <option value="agency">Ajans</option>
          <option value="company">Şirket</option>
          <option value="developer">Yazılımcı</option>
          <option value="designer">Tasarımcı</option>
          <option value="content_creator">İçerik üreticisi</option>
          <option value="other">Diğer</option>
        </select>
      </Field>
      <Field label="Telefon">
        <input name="phone" className={inputClass} />
      </Field>
      <Field label="E-posta">
        <input name="email" type="email" className={inputClass} />
      </Field>
      <Field label="Vergi dairesi">
        <input name="tax_office" className={inputClass} />
      </Field>
      <Field label="Vergi numarası">
        <input name="tax_number" className={inputClass} />
      </Field>
      <Field label="Banka bilgileri" className="sm:col-span-2">
        <textarea
          name="bank_details"
          rows={3}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      {state?.error && (
        <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>
      )}
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Kaydediliyor…" : "Tedarikçi oluştur"}
        </Button>
      </div>
    </form>
  );
}
