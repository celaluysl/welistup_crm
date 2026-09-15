"use client";

import { useActionState } from "react";
import { setFinancialReportsMenu } from "@/lib/actions/permissions";
import { Button } from "@/components/ui/button";

export function FeatureSettingsForm({
  financialReportsEnabled,
}: {
  financialReportsEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(setFinancialReportsMenu, null);
  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-4">
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" name="enabled" defaultChecked={financialReportsEnabled} className="size-5 accent-[#CD0B16]" />
        <span>
          <span className="block font-semibold text-slate-800">Finansal Raporlar menüsünü göster</span>
          <span className="mt-0.5 block text-sm text-slate-500">Kapalı olduğunda rapor sayfası sol menüde görünmez.</span>
        </span>
      </label>
      <Button disabled={pending}>{pending ? "Kaydediliyor…" : "Menü ayarını kaydet"}</Button>
      {(state?.error || state?.success) && (
        <p className={`w-full text-sm ${state.error ? "text-red-600" : "text-emerald-600"}`}>{state.error || state.success}</p>
      )}
    </form>
  );
}
