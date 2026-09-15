"use client";

import { useActionState } from "react";
import { updateMonthCloseCashTargets } from "@/lib/actions/month-close";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

export function MonthCloseCashTargetForm({
  year,
  month,
  invoicedTarget,
  uninvoicedTarget,
}: {
  year: number;
  month: number;
  invoicedTarget: number;
  uninvoicedTarget: number;
}) {
  const [state, action, pending] = useActionState(updateMonthCloseCashTargets, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <Field label="Faturalı kasa sabit hedefi">
        <input name="invoiced_target" type="number" min="0" step="0.01" defaultValue={invoicedTarget} className={inputClass} />
      </Field>
      <Field label="Faturasız kasa sabit hedefi">
        <input name="uninvoiced_target" type="number" min="0" step="0.01" defaultValue={uninvoicedTarget} className={inputClass} />
      </Field>
      <Button disabled={pending}>{pending ? "Kaydediliyor…" : "Kasa hedeflerini kaydet"}</Button>
      {state?.error && <p className="text-sm text-red-600 sm:col-span-2 xl:col-span-3">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700 sm:col-span-2 xl:col-span-3">{state.success}</p>}
    </form>
  );
}
