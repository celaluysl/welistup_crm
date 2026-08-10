"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus, ReceiptText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createManualExpense,
  payManualExpense,
  repeatManualExpense,
  updateManualExpense,
} from "@/lib/actions/expenses";
import {
  payVendorAccrual,
  updateVendorAccrualAmount,
} from "@/lib/actions/vendors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { formatMoney } from "@/lib/utils";

export type ExpenseRow = {
  id: string;
  source: "vendor" | "manual";
  templateId?: string | null;
  groupKey: string;
  month: number;
  name: string;
  category: string;
  net: number;
  vatRate: number;
  vat: number;
  total: number;
  paid: number;
  currency: string;
  billing: "invoiced" | "uninvoiced";
  dueDate: string | null;
  notes: string | null;
  requiresReview: boolean;
};
type Account = {
  id: string;
  name: string;
  currency: string;
  billing_preference: string;
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

export function ExpenseYearWorkspace({
  rows,
  accounts,
  year,
  billing,
}: {
  rows: ExpenseRow[];
  accounts: Account[];
  year: number;
  billing: "invoiced" | "uninvoiced";
}) {
  const [selected, setSelected] = useState<ExpenseRow | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const summary = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({ total: a.total + r.total, paid: a.paid + r.paid }),
        { total: 0, paid: 0 },
      ),
    [rows],
  );
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { name: string; category: string; months: Map<number, ExpenseRow> }
    >();
    for (const row of rows) {
      const g = map.get(row.groupKey) || {
        name: row.name,
        category: row.category,
        months: new Map(),
      };
      g.months.set(row.month, row);
      map.set(row.groupKey, g);
    }
    return [...map.values()];
  }, [rows]);
  const done = () => {
    setSelected(null);
    setCreating(false);
    router.refresh();
  };
  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Summary label="Yıllık toplam gider" value={summary.total} />
        <Summary label="Ödenen" value={summary.paid} green />
        <Summary
          label="Kalan"
          value={Math.max(0, summary.total - summary.paid)}
          red
        />
      </div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} />
          Yeni gider ekle
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-[1750px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 z-20 min-w-64 border-b border-r bg-slate-50 px-4 py-3">
                Gider kalemi
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  className="min-w-32 border-b border-l px-3 py-3 text-center"
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.name + g.category} className="border-b last:border-0">
                <td className="sticky left-0 z-10 border-r bg-white px-4 py-3">
                  <b>{g.name}</b>
                  <div className="mt-0.5 text-slate-400">{g.category}</div>
                </td>
                {Array.from({ length: 12 }, (_, i) => {
                  const r = g.months.get(i + 1);
                  return (
                    <td key={i} className="border-l p-1.5">
                      {r ? (
                        <Cell row={r} onClick={() => setSelected(r)} />
                      ) : (
                        <div className="h-14 rounded-lg bg-slate-50" />
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
            Bu yıl için {billing === "invoiced" ? "faturalı" : "faturasız"}{" "}
            gider kaydı yok.
          </div>
        )}
      </div>
      {creating && (
        <CreateDialog
          year={year}
          billing={billing}
          onClose={() => setCreating(false)}
          onSaved={done}
        />
      )}{" "}
      {selected && (
        <DetailDialog
          row={selected}
          accounts={accounts.filter(
            (a) =>
              a.currency === selected.currency &&
              a.billing_preference === selected.billing,
          )}
          onClose={() => setSelected(null)}
          onSaved={done}
        />
      )}
    </>
  );
}
function Cell({ row, onClick }: { row: ExpenseRow; onClick: () => void }) {
  const remaining = Math.max(0, row.total - row.paid);
  return (
    <button
      onClick={onClick}
      className={`h-14 w-full rounded-lg px-2 py-1.5 text-left transition ${row.requiresReview ? "bg-amber-50" : remaining === 0 ? "bg-emerald-50 hover:bg-emerald-100" : "bg-slate-50 hover:bg-slate-100"}`}
    >
      <b>
        {row.requiresReview
          ? "Tutar bekliyor"
          : formatMoney(row.total, row.currency)}
      </b>
      <div className="mt-0.5 text-[10px] text-slate-500">
        {row.requiresReview
          ? "Aylık bedeli girin"
          : remaining === 0
            ? "Ödendi"
            : `Kalan ${formatMoney(remaining, row.currency)}`}
      </div>
    </button>
  );
}
function CreateDialog({
  year,
  billing,
  onClose,
  onSaved,
}: {
  year: number;
  billing: "invoiced" | "uninvoiced";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(createManualExpense, null);
  const [recurrence, setRecurrence] = useState<"one_time" | "monthly">(
    "one_time",
  );
  useEffect(() => {
    if (state?.success) onSaved();
  }, [state?.success, onSaved]);
  return (
    <Modal title="Yeni gider ekle" onClose={onClose}>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="billing_preference" value={billing} />
        <Field label="Gider adı">
          <input
            name="name"
            required
            className={inputClass}
            placeholder="Kredi kartı, ofis, yazılım…"
          />
        </Field>
        <Field label="Kategori">
          <input
            name="category"
            required
            className={inputClass}
            placeholder="Genel gider"
          />
        </Field>
        <Field label="Yıl">
          <input
            name="year"
            type="number"
            defaultValue={year}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Ay">
          <select
            name="month"
            defaultValue={new Date().getMonth() + 1}
            className={inputClass}
          >
            {months.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tekrarlama">
          <select
            name="recurrence"
            value={recurrence}
            onChange={(event) =>
              setRecurrence(event.target.value as "one_time" | "monthly")
            }
            className={inputClass}
          >
            <option value="one_time">Yalnızca bu ay</option>
            <option value="monthly">Her ay tekrarla</option>
          </select>
        </Field>
        {recurrence === "monthly" && (
          <Field label="Tekrarlama bitişi (opsiyonel)">
            <input name="ends_on" type="date" className={inputClass} />
          </Field>
        )}
        <Field label="Net tutar">
          <input
            name="net_amount"
            type="number"
            min="0"
            step="0.01"
            required
            className={inputClass}
          />
        </Field>
        <Field label="KDV (%)">
          <input
            name="vat_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={billing === "invoiced" ? 20 : 0}
            disabled={billing === "uninvoiced"}
            className={inputClass}
          />
          {billing === "uninvoiced" && (
            <input type="hidden" name="vat_rate" value="0" />
          )}
        </Field>
        <Field label="Para birimi">
          <select name="currency" className={inputClass}>
            {["TRY", "USD", "EUR", "GBP"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Vade">
          <input name="due_date" type="date" className={inputClass} />
        </Field>
        <Field label="Not" className="sm:col-span-2">
          <textarea name="notes" className={inputClass} />
        </Field>
        <Result state={state} />
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button disabled={pending}>
            {pending ? "Kaydediliyor…" : "Gideri kaydet"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function DetailDialog({
  row,
  accounts,
  onClose,
  onSaved,
}: {
  row: ExpenseRow;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const remaining = Math.max(0, row.total - row.paid);
  return (
    <Modal title={`${months[row.month - 1]} · ${row.name}`} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Net" value={row.net} currency={row.currency} />
        <Metric label="KDV" value={row.vat} currency={row.currency} />
        <Metric label="Toplam" value={row.total} currency={row.currency} />
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
        {row.category}
        {row.notes ? ` · ${row.notes}` : ""}
      </div>
      {row.source === "manual" && (
        <ManualExpenseEditor row={row} onSaved={onSaved} />
      )}
      {row.requiresReview && row.source === "vendor" ? (
        <VendorReview row={row} onSaved={onSaved} />
      ) : remaining > 0 ? (
        <Payment
          row={row}
          remaining={remaining}
          accounts={accounts}
          onSaved={onSaved}
        />
      ) : (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          Bu gider tamamen ödendi.
        </div>
      )}
    </Modal>
  );
}
function ManualExpenseEditor({
  row,
  onSaved,
}: {
  row: ExpenseRow;
  onSaved: () => void;
}) {
  const [editState, editAction, editing] = useActionState(
    updateManualExpense,
    null,
  );
  const [repeatState, repeatAction, repeating] = useActionState(
    repeatManualExpense,
    null,
  );
  useEffect(() => {
    if (editState?.success || repeatState?.success) onSaved();
  }, [editState?.success, repeatState?.success, onSaved]);
  return (
    <div className="mt-5 border-t pt-5">
      <h3 className="mb-3 font-semibold">Bu ayın giderini düzenle</h3>
      <form action={editAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="expense_id" value={row.id} />
        <Field label="Gider adı">
          <input
            name="name"
            defaultValue={row.name}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Kategori">
          <input
            name="category"
            defaultValue={row.category}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Net tutar">
          <input
            name="net_amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={row.net}
            required
            className={inputClass}
          />
        </Field>
        <Field label="KDV (%)">
          <input
            name="vat_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={row.vatRate}
            disabled={row.billing === "uninvoiced"}
            className={inputClass}
          />
          {row.billing === "uninvoiced" && (
            <input type="hidden" name="vat_rate" value="0" />
          )}
        </Field>
        <Field label="Vade">
          <input
            name="due_date"
            type="date"
            defaultValue={row.dueDate || ""}
            className={inputClass}
          />
        </Field>
        <Field label="Bu aya özel not">
          <input
            name="notes"
            defaultValue={row.notes || ""}
            className={inputClass}
          />
        </Field>
        <Result state={editState} />
        <div className="sm:col-span-2">
          <Button disabled={editing}>
            {editing ? "Kaydediliyor…" : "Bu ayı güncelle"}
          </Button>
        </div>
      </form>
      {!row.templateId && (
        <form
          action={repeatAction}
          className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="expense_id" value={row.id} />
          <div>
            <b className="text-sm">Sonraki aylarda tekrarla</b>
            <p className="mt-1 text-xs text-slate-500">
              Bu ay korunur; sonraki aylara aynı tutarla yeni kayıtlar
              hazırlanır.
            </p>
          </div>
          <Field label="Bitiş tarihi (opsiyonel)">
            <input name="ends_on" type="date" className={inputClass} />
          </Field>
          <Result state={repeatState} />
          <div className="sm:col-span-2">
            <Button variant="secondary" disabled={repeating}>
              {repeating ? "Hazırlanıyor…" : "Aylık tekrara çevir"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
function VendorReview({
  row,
  onSaved,
}: {
  row: ExpenseRow;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(
    updateVendorAccrualAmount,
    null,
  );
  useEffect(() => {
    if (state?.success) onSaved();
  }, [state?.success, onSaved]);
  return (
    <form
      action={action}
      className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-2"
    >
      <input type="hidden" name="accrual_id" value={row.id} />
      <Field label="Bu ayın net hakedişi">
        <input
          name="net_amount"
          type="number"
          min="0"
          step="0.01"
          required
          className={inputClass}
        />
      </Field>
      <Field label="Açıklama">
        <input name="notes" required className={inputClass} />
      </Field>
      <Result state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>Hakedişi onayla</Button>
      </div>
    </form>
  );
}
function Payment({
  row,
  remaining,
  accounts,
  onSaved,
}: {
  row: ExpenseRow;
  remaining: number;
  accounts: Account[];
  onSaved: () => void;
}) {
  const action = row.source === "vendor" ? payVendorAccrual : payManualExpense;
  const [state, formAction, pending] = useActionState(action, null);
  useEffect(() => {
    if (state?.success) onSaved();
  }, [state?.success, onSaved]);
  return (
    <form
      action={formAction}
      className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-2"
    >
      <input
        type="hidden"
        name={row.source === "vendor" ? "accrual_id" : "expense_id"}
        value={row.id}
      />
      <Field label="Ödeme tutarı">
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
      <Field label="Gider kasası">
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
      <Result state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Kaydediliyor…" : "Ödemeyi kaydet"}
        </Button>
      </div>
    </form>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex justify-between border-b p-5">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <ReceiptText size={20} />
            {title}
          </h2>
          <button onClick={onClose} aria-label="Kapat">
            <X />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
function Summary({
  label,
  value,
  green,
  red,
}: {
  label: string;
  value: number;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={`mt-2 text-xl font-bold ${green ? "text-emerald-700" : red ? "text-[#CD0B16]" : ""}`}
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
      <b className="mt-1 block text-lg">{formatMoney(value, currency)}</b>
    </div>
  );
}
function Result({
  state,
}: {
  state: { error?: string; success?: string } | null;
}) {
  return (
    <>
      {state?.error && (
        <div className="text-sm text-red-600 sm:col-span-2">{state.error}</div>
      )}
    </>
  );
}
