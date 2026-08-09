"use client";

import { useActionState, useState } from "react";
import { Pencil, X } from "lucide-react";
import { updateVariableServicePeriod } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

export function VariablePeriodEditor({ id, amount, notes, currency }: { id: string; amount: number; notes: string | null; currency: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateVariableServicePeriod, null);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#CD0B16]"><Pencil size={12}/>Ayı düzenle</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-bold">Değişken aylık işi düzenle</h2><p className="mt-1 text-xs text-slate-500">Yalnızca bu operasyon ayının tutarı ve iş açıklaması değişir.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></div><form action={action} className="grid gap-4"><input type="hidden" name="service_period_id" value={id}/><Field label={`Bu ayın net tutarı (${currency})`}><input name="net_amount" type="number" min="0" step="0.01" defaultValue={amount} required className={inputClass}/></Field><Field label="Bu ay yapılan iş / açıklama"><textarea name="notes" defaultValue={notes || ""} rows={4} placeholder="Örn. 3 kampanya kurulumu ve optimizasyon" className={`${inputClass} h-auto py-2`}/></Field>{state?.error&&<p className="text-sm text-red-600">{state.error}</p>}{state?.success&&<p className="text-sm text-emerald-700">{state.success}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>{state?.success?"Kapat":"Vazgeç"}</Button><Button disabled={pending}>{pending?"Kaydediliyor…":"Bu ayı güncelle"}</Button></div></form></div></div>}
  </>;
}
