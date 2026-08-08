"use client";
import { useActionState } from "react";
import { generateMonthlyPeriods } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";

export function MonthlyPeriodForm({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const [state, action, pending] = useActionState(generateMonthlyPeriods, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <Button disabled={pending}>
        {pending ? "Oluşturuluyor…" : "Aylık kayıtları oluştur"}
      </Button>
      {state?.success && (
        <span className="text-sm text-emerald-700">{state.success}</span>
      )}
      {state?.error && (
        <span className="text-sm text-red-600">{state.error}</span>
      )}
    </form>
  );
}
