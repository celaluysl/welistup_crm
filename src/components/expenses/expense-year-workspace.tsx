"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus, ReceiptText, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createManualExpense,
  addManualExpenseMonth,
  payManualExpense,
  removeManualExpenseMonth,
  repeatManualExpense,
  updateManualExpenseDefinition,
  updateManualExpense,
} from "@/lib/actions/expenses";
import {
  payVendorAccrual,
  updateVendorAccrualAmount,
} from "@/lib/actions/vendors";
import { transferAccounts } from "@/lib/actions/accounts";
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
export type ExpenseDefinition = {
  id: string;
  name: string;
  category: string;
  net: number;
  vatRate: number;
  currency: string;
  billing: "invoiced" | "uninvoiced";
  dueDay: number | null;
  notes: string | null;
  status: "active" | "inactive" | "archived";
  isRecurring: boolean;
};
type Account = {
  id: string;
  name: string;
  currency: string;
  billing_preference: string;
};
type Replenishment = {
  label: string;
  sourceAccount: Account | null;
  targetAccount: Account | null;
  months: { month: number; spent: number; replenished: number; remaining: number }[];
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
  definitions,
  accounts,
  replenishment,
  year,
  billing,
}: {
  rows: ExpenseRow[];
  definitions: ExpenseDefinition[];
  accounts: Account[];
  replenishment: Replenishment;
  year: number;
  billing: "invoiced" | "uninvoiced";
}) {
  const [selected, setSelected] = useState<ExpenseRow | null>(null);
  const [selectedDefinition, setSelectedDefinition] =
    useState<ExpenseDefinition | null>(null);
  const [addingMonth, setAddingMonth] = useState<{
    definition: ExpenseDefinition;
    month: number;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "active" | "inactive" | "archived"
  >("active");
  const [creating, setCreating] = useState(false);
  const [replenishmentMonth, setReplenishmentMonth] = useState<number | null>(null);
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
      {
        key: string;
        name: string;
        category: string;
        source: ExpenseRow | null;
        definition: ExpenseDefinition | null;
        status: "active" | "inactive" | "archived";
        months: Map<number, ExpenseRow>;
      }
    >();
    for (const definition of definitions) {
      map.set(`manual-template:${definition.id}`, {
        key: `manual-template:${definition.id}`,
        name: definition.name,
        category: definition.category,
        source: null,
        definition,
        status: definition.status,
        months: new Map(),
      });
    }
    for (const row of rows) {
      const g = map.get(row.groupKey) || {
        key: row.groupKey,
        name: row.name,
        category: row.category,
        source: row,
        definition: null,
        status: "active" as const,
        months: new Map(),
      };
      g.source ||= row;
      g.months.set(row.month, row);
      map.set(row.groupKey, g);
    }
    return [...map.values()].filter(
      (group) => !group.definition || group.status === statusFilter,
    );
  }, [definitions, rows, statusFilter]);
  const done = () => {
    setSelected(null);
    setSelectedDefinition(null);
    setAddingMonth(null);
    setCreating(false);
    setReplenishmentMonth(null);
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border bg-white p-1">
          {([
            ["active", "Aktif"],
            ["inactive", "Pasif"],
            ["archived", "Arşiv"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${statusFilter === value ? "bg-[#CD0B16] text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
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
            <tr className="border-b bg-blue-50/40">
              <td className="sticky left-0 z-10 border-r bg-blue-50 px-4 py-3">
                <b>{replenishment.label}</b>
                <div className="mt-0.5 text-slate-500">Ay içi gerçek harcamayı tahsilat kasasından tamamla</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600">Otomatik kasa hesabı</div>
              </td>
              {replenishment.months.map((item) => (
                <td key={item.month} className="border-l p-1.5">
                  <button
                    type="button"
                    onClick={() => setReplenishmentMonth(item.month)}
                    className={`h-14 w-full rounded-lg px-2 py-1.5 text-left transition ${item.remaining > 0 ? "bg-blue-100 hover:bg-blue-200" : "bg-slate-50 hover:bg-blue-50"}`}
                  >
                    <b>{formatMoney(item.remaining)}</b>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      {item.spent > 0 ? `Harcanan ${formatMoney(item.spent)}` : "Harcama yok"}
                    </div>
                  </button>
                </td>
              ))}
            </tr>
            {groups.map((g) => (
              <tr key={g.key} className="border-b last:border-0">
                <td className="sticky left-0 z-10 border-r bg-white px-4 py-3">
                  {g.definition ? (
                    <button
                      type="button"
                      onClick={() => setSelectedDefinition(g.definition)}
                      className="w-full rounded-md text-left hover:text-[#CD0B16]"
                    >
                      <b>{g.name}</b>
                      <div className="mt-0.5 text-slate-400">{g.category}</div>
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {g.definition.isRecurring ? "Aylık tekrar" : "İhtiyaca göre"} · {g.status === "active" ? "Aktif" : g.status === "inactive" ? "Pasif" : "Arşiv"}
                      </div>
                    </button>
                  ) : (
                    <><b>{g.name}</b><div className="mt-0.5 text-slate-400">{g.category}</div></>
                  )}
                </td>
                {Array.from({ length: 12 }, (_, i) => {
                  const r = g.months.get(i + 1);
                  return (
                    <td key={i} className="border-l p-1.5">
                      {r ? (
                        <Cell row={r} onClick={() => setSelected(r)} />
                      ) : (
                        g.definition ? (
                          <button
                            type="button"
                            onClick={() => setAddingMonth({ definition: g.definition!, month: i + 1 })}
                            className="group flex h-14 w-full items-center justify-center rounded-lg bg-slate-50 text-slate-300 transition hover:bg-red-50 hover:text-[#CD0B16]"
                            aria-label={`${months[i]} ayına ${g.name} giderini ekle`}
                          >
                            <span className="flex items-center gap-1 text-[11px] font-semibold opacity-0 transition group-hover:opacity-100"><Plus size={14} /> Bu aya ekle</span>
                          </button>
                        ) : (
                          <div className="h-14 rounded-lg bg-slate-50" />
                        )
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
      {addingMonth && (
        <AddMonthDialog
          definition={addingMonth.definition}
          year={year}
          month={addingMonth.month}
          onClose={() => setAddingMonth(null)}
          onSaved={done}
        />
      )}
      {selectedDefinition && (
        <DefinitionDialog
          definition={selectedDefinition}
          onClose={() => setSelectedDefinition(null)}
          onSaved={done}
        />
      )}
      {replenishmentMonth !== null && (
        <ReplenishmentDialog
          year={year}
          item={replenishment.months[replenishmentMonth - 1]}
          config={replenishment}
          onClose={() => setReplenishmentMonth(null)}
          onSaved={done}
        />
      )}
    </>
  );
}
function ReplenishmentDialog({ year, item, config, onClose, onSaved }: { year: number; item: Replenishment["months"][number]; config: Replenishment; onClose: () => void; onSaved: () => void }) {
  const [state, action, pending] = useActionState(transferAccounts, null);
  useEffect(() => { if (state?.success) onSaved(); }, [state?.success, onSaved]);
  const ready = Boolean(config.sourceAccount && config.targetAccount);
  return <Modal title={`${months[item.month - 1]} · ${config.label} tamamlama`} onClose={onClose}>
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Ay içinde harcanan" value={item.spent} currency="TRY" />
      <Metric label="Tamamlanan" value={item.replenished} currency="TRY" />
      <Metric label="Kalan ihtiyaç" value={item.remaining} currency="TRY" />
    </div>
    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
      {config.sourceAccount?.name || "Tahsilat kasası bulunamadı"} → {config.targetAccount?.name || "Gider kasası bulunamadı"}
    </div>
    <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="source" value={config.sourceAccount?.id || ""} />
      <input type="hidden" name="target" value={config.targetAccount?.id || ""} />
      <Field label="Aktarılacak tutar"><input name="amount" type="number" min="0.01" step="0.01" defaultValue={item.remaining || ""} required className={inputClass} /></Field>
      <Field label="Transfer tarihi"><input name="date" type="date" defaultValue={`${year}-${String(item.month).padStart(2, "0")}-${String(new Date(year, item.month, 0).getDate()).padStart(2, "0")}`} required className={inputClass} /></Field>
      <Field label="Not" className="sm:col-span-2"><input name="description" defaultValue={`${months[item.month - 1]} ${year} gider kasası tamamlama`} required className={inputClass} /></Field>
      <Result state={state} />
      {!ready && <p className="text-sm text-red-600 sm:col-span-2">Gerekli tahsilat veya gider kasası aktif değil. Yönetim → Kasalar ekranından kontrol edin.</p>}
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={onClose}>Vazgeç</Button><Button disabled={pending || !ready}>{pending ? "Aktarılıyor…" : "Kasayı tamamla"}</Button></div>
    </form>
  </Modal>;
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
  const [removeState, removeAction, removing] = useActionState(
    removeManualExpenseMonth,
    null,
  );
  useEffect(() => {
    if (editState?.success || repeatState?.success || removeState?.success) onSaved();
  }, [editState?.success, repeatState?.success, removeState?.success, onSaved]);
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
      <form action={removeAction} className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <input type="hidden" name="expense_id" value={row.id} />
        <div><b className="text-sm">Bu aydaki kaydı kaldır</b><p className="mt-1 text-xs text-slate-500">Diğer aylar ve aylık tekrar ayarı korunur.</p></div>
        <Button type="submit" variant="danger" disabled={removing || row.paid > 0} onClick={(event) => { if (!window.confirm("Bu gideri yalnızca bu aydan kaldırmak istiyor musunuz?")) event.preventDefault(); }}><Trash2 size={15} /> {removing ? "Kaldırılıyor…" : "Bu aydan kaldır"}</Button>
        <Result state={removeState} />
        {row.paid > 0 && <p className="w-full text-xs text-amber-700">Ödeme işlenmiş kayıt kaldırılamaz.</p>}
      </form>
    </div>
  );
}

function AddMonthDialog({ definition, year, month, onClose, onSaved }: { definition: ExpenseDefinition; year: number; month: number; onClose: () => void; onSaved: () => void }) {
  const [state, action, pending] = useActionState(addManualExpenseMonth, null);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const sourceDueDay = definition.dueDay;
  const dueDate = sourceDueDay ? `${year}-${String(month).padStart(2, "0")}-${String(Math.min(sourceDueDay, maxDay)).padStart(2, "0")}` : "";
  useEffect(() => { if (state?.success) onSaved(); }, [state?.success, onSaved]);
  return <Modal title={`${months[month - 1]} · ${definition.name} ekle`} onClose={onClose}>
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="definition_id" value={definition.id} /><input type="hidden" name="year" value={year} /><input type="hidden" name="month" value={month} />
      <div className="rounded-xl bg-slate-50 p-4 text-sm sm:col-span-2"><b>{definition.name}</b><div className="mt-1 text-slate-500">{definition.category} · Yalnızca {months[month - 1]} {year} kaydı oluşturulur.</div></div>
      <Field label="Net tutar"><input name="net_amount" type="number" min="0" step="0.01" defaultValue={definition.net} required className={inputClass} /></Field>
      <Field label="KDV (%)"><input name="vat_rate" type="number" min="0" max="100" step="0.01" defaultValue={definition.billing === "invoiced" ? definition.vatRate : 0} disabled={definition.billing === "uninvoiced"} className={inputClass} />{definition.billing === "uninvoiced" && <input type="hidden" name="vat_rate" value="0" />}</Field>
      <Field label="Vade"><input name="due_date" type="date" defaultValue={dueDate} className={inputClass} /></Field>
      <Field label="Bu aya özel not"><input name="notes" defaultValue={definition.notes || ""} className={inputClass} /></Field>
      <Result state={state} />
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={onClose}>Vazgeç</Button><Button disabled={pending}>{pending ? "Ekleniyor…" : "Bu aya ekle"}</Button></div>
    </form>
  </Modal>;
}

function DefinitionDialog({
  definition,
  onClose,
  onSaved,
}: {
  definition: ExpenseDefinition;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(
    updateManualExpenseDefinition,
    null,
  );
  useEffect(() => {
    if (state?.success) onSaved();
  }, [state?.success, onSaved]);
  return (
    <Modal title={`Gider kalemi · ${definition.name}`} onClose={onClose}>
      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        Bu alan gider kaleminin kalıcı tanımıdır. Pasife veya arşive almak,
        geçmiş aylardaki ödeme ve gider kayıtlarını silmez.
      </div>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="definition_id" value={definition.id} />
        <Field label="Gider adı">
          <input name="name" defaultValue={definition.name} required className={inputClass} />
        </Field>
        <Field label="Kategori">
          <input name="category" defaultValue={definition.category} required className={inputClass} />
        </Field>
        <Field label="Durum">
          <select name="status" defaultValue={definition.status} className={inputClass}>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
            <option value="archived">Arşiv</option>
          </select>
        </Field>
        <Field label="Çalışma biçimi">
          <select
            name="is_recurring"
            defaultValue={String(definition.isRecurring)}
            className={inputClass}
          >
            <option value="false">İhtiyaç olduğunda aya ekle</option>
            <option value="true">Her ay otomatik oluştur</option>
          </select>
        </Field>
        <Field label="Genel not" className="sm:col-span-2">
          <textarea name="notes" defaultValue={definition.notes || ""} className={inputClass} />
        </Field>
        <Result state={state} />
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button disabled={pending}>{pending ? "Kaydediliyor…" : "Gider kalemini güncelle"}</Button>
        </div>
      </form>
    </Modal>
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
