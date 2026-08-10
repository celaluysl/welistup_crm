"use client";

import { useActionState, useEffect } from "react";
import { updateProfileAccess } from "@/lib/actions/core";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

export function ProfileAccessForm({
  profileId,
  firstName,
  lastName,
  email,
  phone,
  roleId,
  employmentType,
  status,
  baseSalary,
  salaryCurrency,
  roles,
  onSuccess,
}: {
  profileId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roleId: string | null;
  employmentType: string;
  status: string;
  baseSalary: number;
  salaryCurrency: string;
  roles: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(updateProfileAccess, null);
  useEffect(() => {
    if (state?.success) onSuccess?.();
  }, [state?.success, onSuccess]);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="profile_id" value={profileId} />
      <Field label="Ad"><input name="first_name" defaultValue={firstName} required className={inputClass} /></Field>
      <Field label="Soyad"><input name="last_name" defaultValue={lastName} required className={inputClass} /></Field>
      <Field label="E-posta"><input value={email} disabled className={`${inputClass} bg-slate-50`} /></Field>
      <Field label="Telefon"><input name="phone" defaultValue={phone || ""} className={inputClass} /></Field>
      <Field label="Rol"><select
        aria-label="Rol"
        name="role_id"
        defaultValue={roleId || ""}
        required
        className={inputClass}
      >
        <option value="">Rol seçin</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select></Field>
      <Field label="Çalışma tipi"><select
        aria-label="Çalışma tipi"
        name="employment_type"
        defaultValue={employmentType}
        className={inputClass}
      >
        <option value="partner">Ortak</option>
        <option value="employee">Bordrolu çalışan</option>
        <option value="freelancer">Freelancer</option>
        <option value="outsourced">Dış kaynak</option>
        <option value="other">Diğer</option>
      </select></Field>
      <Field label="Erişim durumu"><select
        aria-label="Durum"
        name="status"
        defaultValue={status}
        className={inputClass}
      >
        <option value="active">Aktif</option>
        <option value="inactive">Pasif</option>
        <option value="archived">Arşiv</option>
      </select></Field>
      <Field label="Aylık maaş"><input
        aria-label="Aylık maaş"
        title="Aylık maaş"
        name="base_salary"
        type="number"
        min="0"
        step="0.01"
        defaultValue={baseSalary}
        placeholder="Aylık maaş"
        className={inputClass}
      /></Field>
      <Field label="Maaş para birimi"><select
        aria-label="Maaş para birimi"
        name="salary_currency"
        defaultValue={salaryCurrency}
        className={inputClass}
      >
        {["TRY", "USD", "EUR", "GBP"].map((currency) => (
          <option key={currency}>{currency}</option>
        ))}
      </select></Field>
      {(state?.error || state?.success) && (
        <p
          className={`text-sm sm:col-span-2 ${state.error ? "text-red-600" : "text-emerald-600"}`}
        >
          {state.error || state.success}
        </p>
      )}
      <div className="flex justify-end sm:col-span-2"><Button disabled={pending}>{pending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</Button></div>
    </form>
  );
}
