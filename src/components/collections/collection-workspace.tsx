"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Grid3X3, List, Pencil, Search, X } from "lucide-react";
import {
  PaymentEditForm,
  PaymentForm,
  ReceiptClassificationForm,
} from "@/components/forms/collection-forms";
import { formatMoney } from "@/lib/utils";

export type CollectionRow = {
  id: string;
  projectServiceId: string;
  month: number;
  client: string;
  project: string;
  service: string;
  billing: "invoiced" | "uninvoiced";
  total: number;
  paid: number;
  currency: string;
  dueDate: string | null;
  coverageStart: string | null;
  coverageEnd: string | null;
  status: string;
  payments: {
    id: string;
    amount: number;
    paymentDate: string;
    accountId: string | null;
    accountName: string | null;
    notes: string | null;
  }[];
  excessReceipts: {
    id: string;
    amount: number;
    remainingAmount: number;
    receivedDate: string;
    status: string;
    accountName: string | null;
    notes: string | null;
    matchedService: string | null;
  }[];
};
type Account = { id: string; name: string; currency: string };
type HostingPaymentTotal = {
  month: number;
  currency: string;
  amount: number;
  count: number;
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

export function CollectionWorkspace({
  rows,
  accounts,
  services,
  year,
  hostingPayments,
}: {
  rows: CollectionRow[];
  accounts: Account[];
  services: { id: string; name: string }[];
  year: number;
  hostingPayments: HostingPaymentTotal[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [service, setService] = useState("");
  const [billing, setBilling] = useState("");
  const [view, setView] = useState<"matrix" | "list">("matrix");
  const [selected, setSelected] = useState<CollectionRow | null>(null);
  const serviceNames = [...new Set(rows.map((row) => row.service))].sort(
    (a, b) => a.localeCompare(b, "tr"),
  );
  const filtered = rows.filter(
    (row) =>
      (!query ||
        `${row.client} ${row.project}`
          .toLocaleLowerCase("tr-TR")
          .includes(query.toLocaleLowerCase("tr-TR"))) &&
      (!service || row.service === service) &&
      (!billing || row.billing === billing),
  );
  const summary = useMemo(
    () => {
      const projectSummary = filtered
        .filter((row) => row.currency === "TRY")
        .reduce(
          (value, row) => ({
            expected: value.expected + row.total,
            collected: value.collected + totalCollected(row),
            remaining: value.remaining + Math.max(0, row.total - row.paid),
            overdue:
              value.overdue + (isOverdue(row) ? row.total - row.paid : 0),
          }),
          { expected: 0, collected: 0, remaining: 0, overdue: 0 },
        ),
        hostingCollected = hostingPayments
          .filter((payment) => payment.currency === "TRY")
          .reduce((sum, payment) => sum + payment.amount, 0);
      return {
        ...projectSummary,
        collected: projectSummary.collected + hostingCollected,
      };
    },
    [filtered, hostingPayments],
  );
  const hostingMonths = useMemo(() => {
    const map = new Map<number, HostingPaymentTotal[]>();
    for (const payment of hostingPayments) {
      map.set(payment.month, [...(map.get(payment.month) || []), payment]);
    }
    return map;
  }, [hostingPayments]);
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        client: string;
        project: string;
        service: string;
        billing: CollectionRow["billing"];
        months: Map<number, CollectionRow>;
      }
    >();
    filtered.forEach((row) => {
      const current = map.get(row.projectServiceId) || {
        client: row.client,
        project: row.project,
        service: row.service,
        billing: row.billing,
        months: new Map(),
      };
      current.months.set(row.month, row);
      map.set(row.projectServiceId, current);
    });
    return [...map.values()];
  }, [filtered]);

  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary
          label="Beklenen tahsilat"
          value={formatMoney(summary.expected, "TRY")}
        />
        <Summary
          label="Kasaya giren"
          value={formatMoney(summary.collected, "TRY")}
          positive
        />
        <Summary
          label="Kalan tahsilat"
          value={formatMoney(summary.remaining, "TRY")}
        />
        <Summary
          label="Vadesi geçen alacak"
          value={formatMoney(summary.overdue, "TRY")}
          danger
        />
      </div>
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="min-w-60 flex-1 text-xs font-medium text-slate-500">
          <span className="mb-1.5 block">Müşteri veya proje ara</span>
          <div className="relative">
            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={16}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm"
              placeholder="Müşteri, proje veya domain"
            />
          </div>
        </label>
        <Filter label="Hizmet" value={service} onChange={setService}>
          <option value="">Tüm hizmetler</option>
          {serviceNames.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </Filter>
        <Filter label="Faturalama" value={billing} onChange={setBilling}>
          <option value="">Tümü</option>
          <option value="invoiced">Faturalı</option>
          <option value="uninvoiced">Faturasız</option>
        </Filter>
        <div className="flex h-10 rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setView("matrix")}
            title="Matris görünümü"
            className={`rounded-md px-3 ${view === "matrix" ? "bg-white text-[#CD0B16] shadow-sm" : "text-slate-500"}`}
          >
            <Grid3X3 size={17} />
          </button>
          <button
            onClick={() => setView("list")}
            title="Liste görünümü"
            className={`rounded-md px-3 ${view === "list" ? "bg-white text-[#CD0B16] shadow-sm" : "text-slate-500"}`}
          >
            <List size={17} />
          </button>
        </div>
      </div>
      {view === "matrix" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[2200px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="sticky left-0 z-20 min-w-72 border-b border-r bg-slate-50 px-4 py-3">
                  Müşteri / Proje
                </th>
                <th className="min-w-32 border-b px-3">Hizmet</th>
                <th className="min-w-24 border-b px-3">Fatura</th>
                {months.map((month) => (
                  <th
                    key={month}
                    className="min-w-32 border-b border-l px-3 text-center"
                  >
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-orange-50/30">
                <td className="sticky left-0 z-10 border-r bg-orange-50 px-4 py-3">
                  <div className="font-semibold text-slate-800">
                    Toplu Sunucu Ödemeleri
                  </div>
                  <div className="mt-1 text-slate-400">
                    Yalnızca tahsilat yapılan aylar
                  </div>
                </td>
                <td className="px-3 font-medium">Sunucu</td>
                <td className="px-3">
                  <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">
                    Tahsilat
                  </span>
                </td>
                {Array.from({ length: 12 }, (_, index) => {
                  const payments = hostingMonths.get(index + 1) || [];
                  return (
                    <td key={index} className="border-l p-1.5">
                      {payments.length ? (
                        <div className="min-h-16 rounded-lg border border-orange-100 bg-orange-50 px-2 py-1.5 text-left">
                          {payments.map((payment) => (
                            <div key={payment.currency}>
                              <b className="text-orange-900">
                                {formatMoney(payment.amount, payment.currency)}
                              </b>
                              <div className="text-[10px] text-orange-700">
                                {payment.count} sunucu ödemesi
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-16 rounded-lg bg-slate-50" />
                      )}
                    </td>
                  );
                })}
              </tr>
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
                          <MonthCell
                            row={row}
                            onClick={() => setSelected(row)}
                          />
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
              Seçilen filtrelerde tahsilat kaydı bulunamadı.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs text-slate-500">
              <tr>
                {[
                  "Müşteri / Proje",
                  "Hizmet",
                  "Dönem",
                  "Beklenen",
                  "Kasaya giren",
                  "Kalan",
                  "Vade",
                  "Durum",
                ].map((x) => (
                  <th key={x} className="px-4 py-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <b>{row.project}</b>
                    <div className="text-xs text-slate-400">{row.client}</div>
                  </td>
                  <td className="px-4">{row.service}</td>
                  <td className="px-4">
                    {months[row.month - 1]} {year}
                  </td>
                  <td className="px-4">
                    {formatMoney(row.total, row.currency)}
                  </td>
                  <td className="px-4 text-emerald-700">
                    <b>{formatMoney(totalCollected(row), row.currency)}</b>
                    {excessForRow(row) > 0 && (
                      <div className="text-xs text-amber-700">
                        {formatMoney(excessForRow(row), row.currency)}{" "}
                        eşleştirme bekliyor
                      </div>
                    )}
                  </td>
                  <td className="px-4 font-medium">
                    {formatMoney(row.total - row.paid, row.currency)}
                  </td>
                  <td className="px-4">{row.dueDate || "—"}</td>
                  <td className="px-4">
                    <Status row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <PaymentModal
          row={selected}
          accounts={accounts.filter(
            (account) => account.currency === selected.currency,
          )}
          services={services}
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
  row: CollectionRow;
  onClick: () => void;
}) {
  const remaining = Math.max(0, row.total - row.paid);
  const collected = totalCollected(row);
  const excess = excessForRow(row);
  const tone =
    row.status === "paid"
      ? "bg-emerald-50 hover:bg-emerald-100"
      : row.status === "partial"
        ? "bg-amber-50 hover:bg-amber-100"
        : isOverdue(row)
          ? "bg-red-50 hover:bg-red-100"
          : "bg-slate-50 hover:bg-slate-100";
  return (
    <button
      onClick={onClick}
      className={`h-16 w-full rounded-lg p-2 text-left transition ${tone}`}
    >
      <div className="font-bold text-slate-800">
        {collected ? formatMoney(collected, row.currency) : "Ödeme bekliyor"}
      </div>
      {excess > 0 ? (
        <div className="mt-1 text-[10px] font-medium text-amber-700">
          {formatMoney(excess, row.currency)} eşleştirme bekliyor
        </div>
      ) : (
        <div className="mt-1 text-[10px] text-slate-500">
          Beklenen {formatMoney(row.total, row.currency)}
        </div>
      )}
      {remaining > 0 && row.paid > 0 && (
        <div className="text-[10px] text-amber-700">
          Kalan {formatMoney(remaining, row.currency)}
        </div>
      )}
    </button>
  );
}
function excessForRow(row: CollectionRow) {
  return row.excessReceipts.reduce(
    (sum, receipt) => sum + receipt.remainingAmount,
    0,
  );
}
function totalCollected(row: CollectionRow) {
  return row.paid + excessForRow(row);
}
function Status({ row }: { row: CollectionRow }) {
  const label =
    row.status === "paid"
      ? "Ödendi"
      : row.status === "partial"
        ? "Kısmi"
        : isOverdue(row)
          ? "Gecikti"
          : "Bekleniyor";
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs ${row.status === "paid" ? "bg-emerald-50 text-emerald-700" : row.status === "partial" ? "bg-amber-50 text-amber-700" : isOverdue(row) ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}
    >
      {label}
    </span>
  );
}
function isOverdue(row: CollectionRow) {
  return (
    row.status !== "paid" &&
    !!row.dueDate &&
    row.dueDate < new Date().toISOString().slice(0, 10)
  );
}
function Summary({
  label,
  value,
  positive,
  danger,
}: {
  label: string;
  value: string;
  positive?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={`mt-2 text-xl font-bold ${positive ? "text-emerald-700" : danger ? "text-[#CD0B16]" : "text-slate-900"}`}
      >
        {value}
      </div>
    </div>
  );
}
function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="min-w-44 text-xs font-medium text-slate-500">
      <span className="mb-1.5 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
      >
        {children}
      </select>
    </label>
  );
}
function PaymentModal({
  row,
  accounts,
  services,
  onClose,
  onSaved,
}: {
  row: CollectionRow;
  accounts: Account[];
  services: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const remaining = Math.max(0, row.total - row.paid);
  const excessTotal = row.excessReceipts.reduce(
    (sum, receipt) => sum + receipt.remainingAmount,
    0,
  );
  const [editingPayment, setEditingPayment] = useState<
    CollectionRow["payments"][number] | null
  >(null);
  const [matchingReceipt, setMatchingReceipt] = useState<
    CollectionRow["excessReceipts"][number] | null
  >(null);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b p-5">
          <div>
            <div className="text-xs text-slate-400">
              {months[row.month - 1]} · {row.service}
            </div>
            <h2 className="mt-1 text-xl font-bold">{row.project}</h2>
            <p className="text-sm text-slate-500">{row.client}</p>
            {row.coverageStart && row.coverageEnd && (
              <p className="mt-1 text-xs font-medium text-[#CD0B16]">
                Kapsanan dönem: {row.coverageStart} – {row.coverageEnd}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </header>
        <div className="p-5">
          <div
            className={`mb-5 grid gap-3 ${excessTotal > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}
          >
            <Mini
              label="Beklenen"
              value={formatMoney(row.total, row.currency)}
            />
            <Mini
              label="Alacağa işlenen"
              value={formatMoney(row.paid, row.currency)}
            />
            <Mini label="Kalan" value={formatMoney(remaining, row.currency)} />
            {excessTotal > 0 && (
              <Mini
                label="Fazla tahsilat"
                value={formatMoney(excessTotal, row.currency)}
                warning
              />
            )}
          </div>
          {excessTotal > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-semibold text-amber-900">
                {formatMoney(excessTotal, row.currency)} eşleştirme bekleyen
                müşteri bakiyesi
              </div>
              <p className="mt-1 text-xs text-amber-700">
                Bu tutar kasaya girdi ancak henüz bir hizmete bağlanmadı.
                Aşağıdaki kayıttan hizmetle eşleştirebilirsiniz.
              </p>
            </div>
          )}
          {remaining > 0 ? (
            <>
              <h3 className="mb-4 font-semibold">Ödeme kaydet</h3>
              <PaymentForm
                receivableId={row.id}
                maxAmount={remaining}
                accounts={accounts}
                onSuccess={onSaved}
              />
            </>
          ) : (
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
              Bu dönem tamamen tahsil edildi.
            </div>
          )}
          <div className="mt-6 border-t pt-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <CalendarDays size={16} />
              Ödeme geçmişi
            </h3>
            <div className="space-y-2">
              {row.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm"
                >
                  <div>
                    <b>{payment.paymentDate}</b>
                    <div className="text-xs text-slate-400">
                      {payment.accountName || "Kasa belirtilmedi"} · Alacağa
                      işlendi
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <b>{formatMoney(payment.amount, row.currency)}</b>
                    <button
                      type="button"
                      title="Ödemeyi düzenle"
                      onClick={() => setEditingPayment(payment)}
                      className="rounded-md border border-slate-200 bg-white p-2 text-slate-500 hover:border-red-200 hover:text-[#CD0B16]"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {row.excessReceipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className={`flex items-center justify-between rounded-lg border p-3 text-sm ${receipt.status === "allocated" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
                >
                  <div>
                    <b>{receipt.receivedDate}</b>
                    <div
                      className={`text-xs ${receipt.status === "allocated" ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {receipt.accountName || "Kasa belirtilmedi"} ·{" "}
                      {receipt.status === "allocated"
                        ? `${receipt.matchedService} ile eşleştirildi`
                        : "Hizmet eşleştirmesi bekliyor"}
                    </div>
                    {receipt.notes && (
                      <div className="mt-1 text-xs text-slate-500">
                        {receipt.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <b
                      className={
                        receipt.status === "allocated"
                          ? "text-emerald-900"
                          : "text-amber-900"
                      }
                    >
                      +{formatMoney(receipt.amount, row.currency)}
                    </b>
                    {receipt.status !== "allocated" && (
                      <button
                        type="button"
                        onClick={() => setMatchingReceipt(receipt)}
                        className="rounded-lg bg-[#CD0B16] px-3 py-2 text-xs font-semibold text-white"
                      >
                        Eşleştir
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!row.payments.length && !row.excessReceipts.length && (
                <div className="text-sm text-slate-400">
                  Henüz ödeme girilmedi.
                </div>
              )}
            </div>
          </div>
          {editingPayment && (
            <div className="mt-5 rounded-xl border border-red-100 bg-red-50/30 p-4">
              <h3 className="mb-4 font-semibold">Ödemeyi düzenle</h3>
              <PaymentEditForm
                payment={editingPayment}
                maxAmount={remaining + editingPayment.amount}
                accounts={accounts}
                onSuccess={onSaved}
                onCancel={() => setEditingPayment(null)}
              />
            </div>
          )}
          {matchingReceipt && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <h3 className="mb-1 font-semibold">
                Fazla tahsilatı hizmetle eşleştir
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                {formatMoney(matchingReceipt.remainingAmount, row.currency)}{" "}
                tutarındaki tahsilatın hangi satıştan geldiğini belirtin.
              </p>
              <ReceiptClassificationForm
                receiptId={matchingReceipt.id}
                services={services}
                onSuccess={onSaved}
                onCancel={() => setMatchingReceipt(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function Mini({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-3 ${warning ? "border border-amber-200 bg-amber-50" : "bg-slate-50"}`}
    >
      <div
        className={`text-xs ${warning ? "text-amber-700" : "text-slate-400"}`}
      >
        {label}
      </div>
      <b className={`mt-1 block ${warning ? "text-amber-900" : ""}`}>{value}</b>
    </div>
  );
}
