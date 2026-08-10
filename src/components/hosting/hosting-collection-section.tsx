"use client";
import { useActionState, useEffect, useState } from "react";
import { Server, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  classifyHostingReceivable,
  payHostingReceivable,
} from "@/lib/actions/hosting";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { formatMoney } from "@/lib/utils";
export type HostingReceivableRow = {
  id: string;
  domain: string;
  customer: string;
  dueDate: string;
  amount: number;
  paid: number;
  currency: string;
  billing: "invoiced" | "uninvoiced" | null;
  status: string;
};
export type HostingPaymentHistoryRow = {
  subscriptionId: string;
  domain: string;
  customer: string;
  currency: string;
  status: string;
  months: { month: number; amount: number; count: number }[];
};
type Account = {
  id: string;
  name: string;
  currency: string;
  billing_preference: string;
};
export function HostingCollectionSection({
  rows,
  historyRows,
  accounts,
  year,
}: {
  rows: HostingReceivableRow[];
  historyRows: HostingPaymentHistoryRow[];
  accounts: Account[];
  year: number;
}) {
  const [selected, setSelected] = useState<HostingReceivableRow | null>(null);
  if (!rows.length && !historyRows.length) return null;
  return (
    <section className="mt-8">
      <HostingPaymentMatrix rows={historyRows} year={year} />
      {rows.length > 0 && <div className="mb-4 mt-8">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Server className="text-[#CD0B16]" />
          Bekleyen sunucu ödemeleri
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Yaklaşan yenilemeleri sınıflandırın ve tahsilatını uygun kasaya
          işleyin.
        </p>
      </div>}
      {rows.length > 0 && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r)}
            className={`rounded-xl border p-4 text-left shadow-sm ${r.billing ? "bg-white" : "border-amber-200 bg-amber-50"}`}
          >
            <div className="flex justify-between gap-3">
              <div>
                <b>{r.domain}</b>
                <div className="mt-1 text-sm text-slate-500">{r.customer}</div>
              </div>
              <b>{formatMoney(r.amount, r.currency)}</b>
            </div>
            <div className="mt-4 flex justify-between text-xs">
              <span>Vade: {date(r.dueDate)}</span>
              <span
                className={
                  r.billing ? "text-slate-500" : "font-semibold text-amber-700"
                }
              >
                {r.billing
                  ? r.billing === "invoiced"
                    ? "Faturalı"
                    : "Faturasız"
                  : "Faturalama türü bekliyor"}
              </span>
            </div>
          </button>
        ))}
      </div>}
      {selected && (
        <Dialog
          row={selected}
          accounts={accounts}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

const months = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function HostingPaymentMatrix({
  rows,
  year,
}: {
  rows: HostingPaymentHistoryRow[];
  year: number;
}) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Server className="text-[#CD0B16]" />
          Sunucu tahsilatları
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {year} yılında gerçekten alınan sunucu ödemeleri, tahsilat tarihinin
          ait olduğu ayda otomatik gösterilir. Ödeme alınmayan aylar boş kalır.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-[1500px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-64 border-b border-r px-4 py-3 text-left">
                Sunucu / Hesap
              </th>
              {months.map((month) => (
                <th key={month} className="border-b border-r px-3 py-3 text-center last:border-r-0">
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.subscriptionId} className="border-b last:border-b-0">
                <td className="border-r px-4 py-3">
                  <div className="flex items-center gap-2">
                    <b>{row.domain}</b>
                    {row.status !== "active" && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        Pasif
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{row.customer}</div>
                </td>
                {months.map((_, index) => {
                  const payment = row.months.find((item) => item.month === index + 1);
                  return (
                    <td key={index} className="border-r p-1.5 last:border-r-0">
                      {payment ? (
                        <div className="min-h-16 rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-emerald-900">
                          <b>{formatMoney(payment.amount, row.currency)}</b>
                          <div className="mt-1 text-[11px] text-emerald-700">
                            Tahsil edildi{payment.count > 1 ? ` · ${payment.count} ödeme` : ""}
                          </div>
                        </div>
                      ) : (
                        <div className="min-h-16 rounded-lg bg-slate-50/80" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Dialog({
  row,
  accounts,
  onClose,
}: {
  row: HostingReceivableRow;
  accounts: Account[];
  onClose: () => void;
}) {
  const router = useRouter();
  const done = () => {
    onClose();
    router.refresh();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <section className="w-full max-w-xl rounded-2xl bg-white">
        <header className="flex justify-between border-b p-5">
          <div>
            <div className="text-sm text-slate-400">
              Sunucu ödemesi · {date(row.dueDate)}
            </div>
            <h2 className="mt-1 text-xl font-bold">{row.domain}</h2>
            <p className="text-sm text-slate-500">{row.customer}</p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-3">
            <Metric
              label="Beklenen"
              value={row.amount}
              currency={row.currency}
            />
            <Metric
              label="Tahsil edilen"
              value={row.paid}
              currency={row.currency}
            />
            <Metric
              label="Kalan"
              value={Math.max(0, row.amount - row.paid)}
              currency={row.currency}
            />
          </div>
          {!row.billing ? (
            <Classify id={row.id} onSaved={done} />
          ) : (
            <Payment
              row={row}
              accounts={accounts.filter(
                (a) =>
                  a.currency === row.currency &&
                  a.billing_preference === row.billing,
              )}
              onSaved={done}
            />
          )}
        </div>
      </section>
    </div>
  );
}
function Classify({ id, onSaved }: { id: string; onSaved: () => void }) {
  const [state, action, pending] = useActionState(
    classifyHostingReceivable,
    null,
  );
  useEffect(() => {
    if (state?.success) onSaved();
  }, [state?.success, onSaved]);
  return (
    <form action={action} className="mt-5 border-t pt-5">
      <input type="hidden" name="receivable_id" value={id} />
      <Field label="Bu ödeme nasıl alınacak?">
        <select name="billing_preference" required className={inputClass}>
          <option value="">Seçin</option>
          <option value="invoiced">Faturalı</option>
          <option value="uninvoiced">Faturasız</option>
        </select>
      </Field>
      <Error state={state} />
      <Button className="mt-3" disabled={pending}>
        Onayla ve tahsilata aç
      </Button>
    </form>
  );
}
function Payment({
  row,
  accounts,
  onSaved,
}: {
  row: HostingReceivableRow;
  accounts: Account[];
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(payHostingReceivable, null);
  useEffect(() => {
    if (state?.success) onSaved();
  }, [state?.success, onSaved]);
  const remaining = Math.max(0, row.amount - row.paid);
  if (!remaining)
    return (
      <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-700">
        Bu ödeme tamamen tahsil edildi.
      </div>
    );
  return (
    <form
      action={action}
      className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-2"
    >
      <input type="hidden" name="receivable_id" value={row.id} />
      <Field label="Tahsilat tutarı">
        <input
          name="amount"
          type="number"
          min="0.01"
          max={remaining}
          step="0.01"
          defaultValue={remaining}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Tahsilat kasası">
        <select name="account_id" required className={inputClass}>
          <option value="">Seçin</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Ödeme tarihi">
        <input
          name="payment_date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Not">
        <input name="notes" className={inputClass} />
      </Field>
      <Error state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>Tahsilatı kaydet</Button>
      </div>
    </form>
  );
}
function Metric({
  label,
  value,
  currency,
}: {
  label: string;
  value: number;
  currency: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <b className="mt-1 block">{formatMoney(value, currency)}</b>
    </div>
  );
}
function Error({ state }: { state: { error?: string } | null }) {
  return state?.error ? (
    <p className="mt-2 text-sm text-red-600 sm:col-span-2">{state.error}</p>
  ) : null;
}
function date(v: string) {
  return new Intl.DateTimeFormat("tr-TR").format(new Date(`${v}T00:00:00`));
}
