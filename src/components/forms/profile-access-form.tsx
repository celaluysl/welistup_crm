"use client";

import { useActionState } from "react";
import { updateProfileAccess } from "@/lib/actions/core";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

export function ProfileAccessForm({
  profileId,
  roleId,
  employmentType,
  status,
  baseSalary,
  salaryCurrency,
  roles,
}: {
  profileId: string;
  roleId: string | null;
  employmentType: string;
  status: string;
  baseSalary: number;
  salaryCurrency: string;
  roles: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(updateProfileAccess, null);
  return (
    <form
      action={action}
      className="grid gap-2 md:grid-cols-2 xl:grid-cols-[160px_160px_140px_140px_110px_auto]"
    >
      <input type="hidden" name="profile_id" value={profileId} />
      <select
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
      </select>
      <select
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
      </select>
      <select
        aria-label="Durum"
        name="status"
        defaultValue={status}
        className={inputClass}
      >
        <option value="active">Aktif</option>
        <option value="inactive">Pasif</option>
        <option value="archived">Arşiv</option>
      </select>
      <input
        aria-label="Aylık maaş"
        title="Aylık maaş"
        name="base_salary"
        type="number"
        min="0"
        step="0.01"
        defaultValue={baseSalary}
        placeholder="Aylık maaş"
        className={inputClass}
      />
      <select
        aria-label="Maaş para birimi"
        name="salary_currency"
        defaultValue={salaryCurrency}
        className={inputClass}
      >
        {["TRY", "USD", "EUR", "GBP"].map((currency) => (
          <option key={currency}>{currency}</option>
        ))}
      </select>
      <Button variant="secondary" disabled={pending}>
        Güncelle
      </Button>
      {(state?.error || state?.success) && (
        <p
          className={`text-xs md:col-span-2 xl:col-span-6 ${state.error ? "text-red-600" : "text-emerald-600"}`}
        >
          {state.error || state.success}
        </p>
      )}
    </form>
  );
}
