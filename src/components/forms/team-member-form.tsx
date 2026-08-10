"use client";
import { useActionState, useEffect } from "react";
import { createTeamMember } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

export function TeamMemberForm({
  roles,
  onSuccess,
}: {
  roles: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(createTeamMember, null);
  useEffect(() => {
    if (state?.success) onSuccess?.();
  }, [state?.success, onSuccess]);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Field label="Ad">
        <input name="first_name" required className={inputClass} />
      </Field>
      <Field label="Soyad">
        <input name="last_name" required className={inputClass} />
      </Field>
      <Field label="E-posta">
        <input name="email" type="email" required className={inputClass} />
      </Field>
      <Field label="Telefon">
        <input name="phone" className={inputClass} />
      </Field>
      <Field label="Rol">
        <select name="role_id" required className={inputClass}>
          <option value="">Rol seçin</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Çalışma tipi">
        <select
          name="employment_type"
          defaultValue="employee"
          className={inputClass}
        >
          <option value="partner">Ortak</option>
          <option value="employee">Bordrolu çalışan</option>
          <option value="freelancer">Freelancer</option>
          <option value="outsourced">Dış kaynak</option>
          <option value="other">Diğer</option>
        </select>
      </Field>
      <Field label="Geçici parola">
        <input
          name="temporary_password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      {state?.success && (
        <p className="sm:col-span-2 xl:col-span-3 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      {state?.error && (
        <p className="sm:col-span-2 xl:col-span-3 text-sm text-red-600">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-2 xl:col-span-3 flex justify-end">
        <Button disabled={pending}>
          {pending ? "Oluşturuluyor…" : "Ekip arkadaşını oluştur"}
        </Button>
      </div>
    </form>
  );
}
