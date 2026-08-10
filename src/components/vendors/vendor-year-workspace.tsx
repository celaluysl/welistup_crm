"use client";
import { useMemo, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export type VendorPeriodRow = {
  id: string;
  assignmentId: string;
  month: number;
  project: string;
  client: string;
  service: string;
  billing: "invoiced" | "uninvoiced";
  net: number;
  vatRate: number;
  vat: number;
  total: number;
  paid: number;
  currency: string;
  dueDate: string | null;
  status: string;
  notes: string | null;
  payments: {
    id: string;
    amount: number;
    paymentDate: string;
    accountName: string | null;
    notes: string | null;
  }[];
};
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

export function VendorYearWorkspace({
  rows,
  year,
}: {
  rows: VendorPeriodRow[];
  year: number;
}) {
  const [selected, setSelected] = useState<VendorPeriodRow | null>(null);
  const summary = useMemo(
    () =>
      rows
        .filter((row) => row.currency === "TRY")
        .reduce(
          (total, row) => ({
            accrued: total.accrued + row.total,
            paid: total.paid + row.paid,
            remaining: total.remaining + Math.max(0, row.total - row.paid),
          }),
          { accrued: 0, paid: 0, remaining: 0 },
        ),
    [rows],
  );
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        project: string;
        client: string;
        service: string;
        billing: VendorPeriodRow["billing"];
        months: Map<number, VendorPeriodRow>;
      }
    >();
    rows.forEach((row) => {
      const current = map.get(row.assignmentId) || {
        project: row.project,
        client: row.client,
        service: row.service,
        billing: row.billing,
        months: new Map(),
      };
      current.months.set(row.month, row);
      map.set(row.assignmentId, current);
    });
    return [...map.values()];
  }, [rows]);
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary label="Toplam hakediş" value={summary.accrued} />
        <Summary label="Ödenen" value={summary.paid} positive />
        <Summary
          label="Kalan"
          value={summary.remaining}
          danger={summary.remaining > 0}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1900px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 z-20 min-w-64 border-b border-r bg-slate-50 px-4 py-3">
                Proje / Müşteri
              </th>
              <th className="min-w-36 border-b px-3">Hizmet</th>
              <th className="min-w-24 border-b px-3">Ödeme</th>
              {months.map((month) => (
                <th
                  key={month}
                  className="min-w-32 border-b border-l px-3 py-3 text-center"
                >
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr
                key={`${group.project}-${group.service}`}
                className="border-b last:border-0"
              >
                <td className="sticky left-0 z-10 border-r bg-white px-4 py-3">
                  <div className="font-semibold text-slate-800">
                    {group.project}
                  </div>
                  <div className="mt-1 text-slate-400">{group.client}</div>
                </td>
                <td className="px-3 font-medium">{group.service}</td>
                <td className="px-3">
                  <span
                    className={`rounded-full px-2 py-1 ${group.billing === "invoiced" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}
                  >
                    {group.billing === "invoiced" ? "Faturalı" : "Faturasız"}
                  </span>
                </td>
                {Array.from({ length: 12 }, (_, index) => {
                  const row = group.months.get(index + 1);
                  return (
                    <td key={index} className="border-l p-1.5">
                      {row ? (
                        <MonthCell row={row} onClick={() => setSelected(row)} />
                      ) : (
                        <div className="h-16 rounded-lg bg-slate-50" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!groups.length && (
          <div className="p-12 text-center text-sm text-slate-400">
            {year} yılı için hakediş kaydı bulunmuyor.
          </div>
        )}
      </div>
      {selected && (
        <PeriodDialog row={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function MonthCell({
  row,
  onClick,
}: {
  row: VendorPeriodRow;
  onClick: () => void;
}) {
  const remaining = Math.max(0, row.total - row.paid);
  const tone =
    row.status === "paid"
      ? "bg-emerald-50 hover:bg-emerald-100"
      : row.status === "partial"
        ? "bg-amber-50 hover:bg-amber-100"
        : row.dueDate && row.dueDate < new Date().toISOString().slice(0, 10)
          ? "bg-red-50 hover:bg-red-100"
          : "bg-slate-50 hover:bg-slate-100";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-16 w-full rounded-lg p-2 text-left transition ${tone}`}
    >
      <div className="font-bold text-slate-800">
        {row.paid ? formatMoney(row.paid, row.currency) : "Ödeme bekliyor"}
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        Hakediş {formatMoney(row.total, row.currency)}
      </div>
      {remaining > 0 && row.paid > 0 && (
        <div className="text-[10px] text-amber-700">
          Kalan {formatMoney(remaining, row.currency)}
        </div>
      )}
    </button>
  );
}
function Summary({
  label,
  value,
  positive,
  danger,
}: {
  label: string;
  value: number;
  positive?: boolean;
  danger?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`mt-1 text-xl font-bold ${positive ? "text-emerald-700" : danger ? "text-red-600" : "text-slate-900"}`}
      >
        {formatMoney(value, "TRY")}
      </div>
    </Card>
  );
}
function PeriodDialog({
  row,
  onClose,
}: {
  row: VendorPeriodRow;
  onClose: () => void;
}) {
  const remaining = Math.max(0, row.total - row.paid);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-period-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b p-5">
          <div>
            <div className="text-sm text-slate-400">
              {months[row.month - 1]} · {row.service}
            </div>
            <h2 id="vendor-period-title" className="mt-1 text-xl font-bold">
              {row.project}
            </h2>
            <p className="text-sm text-slate-500">{row.client}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </header>
        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Hakediş" value={row.total} currency={row.currency} />
            <Metric label="Ödenen" value={row.paid} currency={row.currency} />
            <Metric label="Kalan" value={remaining} currency={row.currency} />
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <div>
              {row.billing === "invoiced"
                ? `Faturalı · ${formatMoney(row.net, row.currency)} net + KDV %${row.vatRate}`
                : "Faturasız · KDV uygulanmaz"}
            </div>
            <div className="mt-1">Vade: {row.dueDate || "—"}</div>
            {row.notes && <div className="mt-2">Not: {row.notes}</div>}
          </div>
          <div className="mt-5 border-t pt-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <CalendarDays size={17} /> Ödeme geçmişi
            </h3>
            <div className="mt-3 space-y-2">
              {row.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
                >
                  <div>
                    <b className="text-sm">{payment.paymentDate}</b>
                    <div className="text-xs text-slate-400">
                      {payment.accountName || "Kasa belirtilmedi"}
                      {payment.notes ? ` · ${payment.notes}` : ""}
                    </div>
                  </div>
                  <b>{formatMoney(payment.amount, row.currency)}</b>
                </div>
              ))}
              {!row.payments.length && (
                <div className="rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-400">
                  Henüz ödeme yapılmadı.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
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
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-bold">
        {formatMoney(value, currency)}
      </div>
    </div>
  );
}
