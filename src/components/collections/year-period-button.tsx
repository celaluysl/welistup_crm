"use client";

import { useActionState } from "react";
import { generateYearPeriods } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";

export function YearPeriodButton({ year }: { year: number }) {
  const [state, action, pending] = useActionState(generateYearPeriods, null);
  return <form action={action} className="flex items-center gap-3"><input type="hidden" name="year" value={year} /><div className={`text-xs ${state?.error ? "text-red-600" : "text-emerald-700"}`}>{state?.error || state?.success}</div><Button disabled={pending}>{pending ? "Oluşturuluyor…" : `${year} kayıtlarını oluştur`}</Button></form>;
}
