"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Pencil, X } from "lucide-react";
import { PayrollPaymentEditForm, PayrollPaymentForm } from "@/components/forms/payroll-forms";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export type PayrollYearRow = {
  id: string;
  profileId: string;
  month: number;
  name: string;
  employmentType: string;
  salary: number;
  paid: number;
  currency: string;
  status: string;
  payments: {
    id: string;
    amount: number;
    paymentDate: string;
    accountId: string;
    accountName: string | null;
    notes: string | null;
  }[];
};
type Account = { id: string; name: string; currency: string };
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
export function PayrollYearWorkspace({
  rows,
  accounts,
  year,
}: {
  rows: PayrollYearRow[];
  accounts: Account[];
  year: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<PayrollYearRow | null>(null);
  const summary = useMemo(
    () =>
      rows
        .filter((row) => row.currency === "TRY")
        .reduce(
          (total, row) => ({
            salary: total.salary + row.salary,
            paid: total.paid + row.paid,
          }),
          { salary: 0, paid: 0 },
        ),
    [rows],
  );
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        employmentType: string;
        months: Map<number, PayrollYearRow>;
      }
    >();
    rows.forEach((row) => {
      const current = map.get(row.profileId) || {
        name: row.name,
        employmentType: row.employmentType,
        months: new Map(),
      };
      current.months.set(row.month, row);
      map.set(row.profileId, current);
    });
    return [...map.values()];
  }, [rows]);
  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Summary label={`${year} toplam maaş`} value={summary.salary} />
        <Summary label="Ödenen" value={summary.paid} positive />
        <Summary
          label="Kalan"
          value={Math.max(0, summary.salary - summary.paid)}
          danger
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1750px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 z-20 min-w-64 border-b border-r bg-slate-50 px-4 py-3">
                Ekip arkadaşı
              </th>
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
              <tr key={group.name} className="border-b last:border-0">
                <td className="sticky left-0 z-10 border-r bg-white px-4 py-3">
                  <div className="font-semibold text-slate-800">
                    {group.name}
                  </div>
                  <div className="mt-1 text-slate-400">
                    {group.employmentType === "partner"
                      ? "Ortak maaşı"
                      : "Personel maaşı"}
                  </div>
                </td>
                {Array.from({ length: 12 }, (_, index) => {
                  const row = group.months.get(index + 1);
                  return (
                    <td key={index} className="border-l p-1.5">
                      {row ? (
                        <MonthCell row={row} onClick={() => setSelected(row)} />
                      ) : (
                        <div className="flex h-20 items-center justify-center rounded-lg bg-slate-50 text-[10px] text-slate-300">
                          Kayıt yok
                        </div>
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
            {year} yılı için maaş kaydı bulunmuyor.
          </div>
        )}
      </div>
      {selected && (
        <PayrollDialog
          row={selected}
          accounts={accounts.filter(
            (account) => account.currency === selected.currency,
          )}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
function MonthCell({
  row,
  onClick,
}: {
  row: PayrollYearRow;
  onClick: () => void;
}) {
  const remaining = Math.max(0, row.salary - row.paid);
  const tone =
    remaining === 0
      ? "bg-emerald-50 hover:bg-emerald-100"
      : row.paid > 0
        ? "bg-amber-50 hover:bg-amber-100"
        : "bg-slate-50 hover:bg-slate-100";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-20 w-full rounded-lg p-2 text-left transition ${tone}`}
    >
      <div className="font-bold text-slate-800">
        {formatMoney(row.salary, row.currency)}
      </div>
      <div
        className={`mt-1 text-[10px] font-medium ${remaining === 0 ? "text-emerald-700" : row.paid > 0 ? "text-amber-700" : "text-slate-500"}`}
      >
        {remaining === 0
          ? "Ödendi"
          : row.paid > 0
            ? `Kalan ${formatMoney(remaining, row.currency)}`
            : "Ödeme bekliyor"}
      </div>
      {row.paid > 0 && (
        <div className="mt-0.5 text-[10px] text-slate-400">
          Ödenen {formatMoney(row.paid, row.currency)}
        </div>
      )}
    </button>
  );
}
function PayrollDialog({
  row,
  accounts,
  onClose,
  onSaved,
}: {
  row: PayrollYearRow;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const remaining = Math.max(0, row.salary - row.paid);
  const [editingPayment, setEditingPayment] = useState<PayrollYearRow["payments"][number] | null>(null);
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
        aria-labelledby="payroll-dialog-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b p-5">
          <div>
            <div className="text-sm text-slate-400">
              {months[row.month - 1]} maaşı
            </div>
            <h2 id="payroll-dialog-title" className="mt-1 text-xl font-bold">
              {row.name}
            </h2>
            <p className="text-sm text-slate-500">
              {row.employmentType === "partner"
                ? "Ortak maaşı"
                : "Personel maaşı"}
            </p>
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
            <Metric label="Maaş" value={row.salary} currency={row.currency} />
            <Metric label="Ödenen" value={row.paid} currency={row.currency} />
            <Metric label="Kalan" value={remaining} currency={row.currency} />
          </div>
          {remaining > 0 && (
            <PayrollPaymentForm
              payrollId={row.id}
              remaining={remaining}
              accounts={accounts}
              onSuccess={onSaved}
            />
          )}
          <div className="mt-5 border-t pt-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <CalendarDays size={17} />
              Ödeme geçmişi
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
                  <div className="flex items-center gap-3">
                    <b>{formatMoney(payment.amount, row.currency)}</b>
                    <button type="button" title="Maaş ödemesini düzenle" onClick={() => setEditingPayment(payment)} className="rounded-md border border-slate-200 bg-white p-2 text-slate-500 hover:border-red-200 hover:text-[#CD0B16]"><Pencil size={14}/></button>
                  </div>
                </div>
              ))}
              {!row.payments.length && (
                <div className="rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-400">
                  Henüz ödeme yapılmadı.
                </div>
              )}
            </div>
            {editingPayment && <div className="mt-4 rounded-xl border border-red-100 bg-red-50/30 p-4"><h3 className="mb-4 font-semibold">Maaş ödemesini düzenle</h3><PayrollPaymentEditForm payment={editingPayment} maxAmount={remaining + editingPayment.amount} accounts={accounts} onSuccess={onSaved} onCancel={() => setEditingPayment(null)}/></div>}
          </div>
        </div>
      </section>
    </div>
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
    <Card className="p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={`mt-2 text-xl font-bold ${positive ? "text-emerald-700" : danger ? "text-[#CD0B16]" : "text-slate-900"}`}
      >
        {formatMoney(value, "TRY")}
      </div>
    </Card>
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
