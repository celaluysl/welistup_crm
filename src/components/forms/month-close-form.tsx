"use client";
import { useActionState } from "react";
import { closeMonth } from "@/lib/actions/month-close";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
export function MonthCloseForm({
  closeId,
  year,
  month,
}: {
  closeId: string;
  year: number;
  month: number;
}) {
  const [state, action, pending] = useActionState(closeMonth, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="close_id" value={closeId} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <Field label="İşletme rezervi">
        <input
          name="reserve"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
          className={inputClass}
        />
      </Field>
      <Field label="Kapanış notları">
        <textarea
          name="notes"
          rows={5}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      {state?.success && (
        <p className="text-sm text-emerald-700">{state.success}</p>
      )}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button disabled={pending}>
        {pending ? "Kapatılıyor…" : "Ayı kapat ve snapshot oluştur"}
      </Button>
    </form>
  );
}
