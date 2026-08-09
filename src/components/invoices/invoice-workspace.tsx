"use client";

import { useState } from "react";
import { CalendarDays, FilePlus2, Hash, ReceiptText, X } from "lucide-react";
import { InvoiceTrackingForm } from "@/components/forms/invoice-tracking-form";
import { formatMoney } from "@/lib/utils";

export type InvoiceWorkspaceRow = {
  id: string;
  client: string;
  project: string;
  service: string;
  year: number;
  month: number;
  amount: number;
  currency: string;
  dueDate: string | null;
  status: string;
  invoice: { invoice_number?: string | null; invoice_date?: string | null; due_date?: string | null; status?: string; notes?: string | null } | null;
};

const labels: Record<string, string> = { waiting: "Fatura bekliyor", issued: "Fatura kesildi", payment_pending: "Ödeme bekleniyor", partial: "Kısmi ödeme", paid: "Ödendi" };
const tones: Record<string, string> = { waiting: "bg-red-50 text-[#CD0B16]", issued: "bg-blue-50 text-blue-700", payment_pending: "bg-amber-50 text-amber-700", partial: "bg-orange-50 text-orange-700", paid: "bg-emerald-50 text-emerald-700" };

export function InvoiceWorkspace({ rows }: { rows: InvoiceWorkspaceRow[] }) {
  const [selected, setSelected] = useState<InvoiceWorkspaceRow | null>(null);
  const [creating, setCreating] = useState(false);
  const waiting = rows.filter((row) => !row.invoice || row.status === "waiting");
  return <>
    <div className="mb-5 flex justify-end"><button type="button" onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#CD0B16] px-4 text-sm font-semibold text-white hover:bg-[#A90912]"><FilePlus2 size={17}/>Yeni fatura ekle</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {rows.map((row) => <button type="button" key={row.id} onClick={() => setSelected(row)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold text-slate-900">{row.client}</div><div className="mt-1 truncate text-xs text-slate-500">{row.project}</div></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${tones[row.status] || tones.waiting}`}>{labels[row.status] || row.status}</span></div><div className="mt-4 flex items-end justify-between gap-3 border-t pt-3"><div><div className="text-xs font-medium text-slate-500">{row.service}</div><div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><CalendarDays size={12}/>{row.month}/{row.year}</div></div><div className="text-right"><div className="font-bold text-slate-900">{formatMoney(row.amount,row.currency)}</div>{row.invoice?.invoice_number&&<div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400"><Hash size={10}/>{row.invoice.invoice_number}</div>}</div></div></button>)}
    </div>
    {selected && <InvoiceModal row={selected} onClose={() => setSelected(null)}/>} 
    {creating && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreating(false); }}><div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold">Yeni fatura takibi</h2><p className="mt-1 text-sm text-slate-500">Fatura kaydı oluşturulacak aylık hizmeti seçin.</p></div><button type="button" onClick={() => setCreating(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={19}/></button></div><div className="space-y-2">{waiting.map((row) => <button type="button" key={row.id} onClick={() => { setCreating(false); setSelected(row); }} className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:border-red-200 hover:bg-red-50/40"><div><b className="text-sm">{row.client}</b><div className="mt-1 text-xs text-slate-500">{row.project} · {row.service}</div></div><b className="text-sm">{formatMoney(row.amount,row.currency)}</b></button>)}{!waiting.length&&<div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">Bu dönemde fatura takibi bekleyen hizmet bulunmuyor.</div>}</div></div></div>}
  </>;
}

function InvoiceModal({ row, onClose }: { row: InvoiceWorkspaceRow; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b p-5"><div><div className="flex items-center gap-2 text-xs text-slate-400"><ReceiptText size={14}/>{row.service} · {row.month}/{row.year}</div><h2 className="mt-1 text-xl font-bold">{row.client}</h2><p className="text-sm text-slate-500">{row.project}</p></div><div className="flex items-start gap-3"><div className="text-right"><b>{formatMoney(row.amount,row.currency)}</b><div className={`mt-1 rounded-full px-2 py-1 text-[10px] font-semibold ${tones[row.status] || tones.waiting}`}>{labels[row.status] || row.status}</div></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={19}/></button></div></header><div className="p-5"><InvoiceTrackingForm periodId={row.id} invoice={row.invoice} defaultDueDate={row.dueDate}/></div></div></div>;
}
