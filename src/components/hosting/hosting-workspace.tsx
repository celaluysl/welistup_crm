"use client";
import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus, Server, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveHostingSubscription } from "@/lib/actions/hosting";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { formatMoney } from "@/lib/utils";
export type HostingRow = {
  id: string;
  domain: string;
  clientId: string | null;
  clientName: string | null;
  accountLabel: string | null;
  status: string;
  isPaid: boolean;
  installationDate: string | null;
  nextPaymentDate: string | null;
  renewalMonths: number;
  fee: number;
  currency: string;
  notes: string | null;
};
type Client = { id: string; name: string };
export function HostingWorkspace({
  rows,
  clients,
}: {
  rows: HostingRow[];
  clients: Client[];
}) {
  const [editing, setEditing] = useState<HostingRow | "new" | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} />
          Sunucu müşterisi ekle
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Site adı",
                  "Bağlı hesap",
                  "Durum",
                  "Ücret",
                  "Kurulum",
                  "Sonraki ödeme",
                  "Kalan gün",
                  "",
                ].map((x) => (
                  <th key={x} className="px-4 py-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const overdue =
                  r.status === "active" &&
                  r.isPaid &&
                  Boolean(r.nextPaymentDate) &&
                  days(r.nextPaymentDate) < 0;
                return (
                <tr
                  key={r.id}
                  className={
                    overdue
                      ? "bg-rose-50/80 hover:bg-rose-100/80"
                      : "hover:bg-slate-50"
                  }
                >
                  <td className="px-4 py-4">
                    <b>{r.domain}</b>
                    {r.notes && (
                      <div className="mt-1 text-xs text-slate-400">
                        {r.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {r.clientName || r.accountLabel || "Bağımsız kayıt"}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${r.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {r.status === "active" ? "Etkin" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {r.isPaid ? formatMoney(r.fee, r.currency) : "Ücretsiz"}
                    <div className="text-xs text-slate-400">
                      {r.renewalMonths} ayda bir
                    </div>
                  </td>
                  <td className="px-4 py-4">{date(r.installationDate)}</td>
                  <td className="px-4 py-4 font-medium">
                    {date(r.nextPaymentDate)}
                  </td>
                  <td
                    className={`px-4 py-4 font-bold ${days(r.nextPaymentDate) <= 30 ? "text-[#CD0B16]" : "text-slate-600"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{r.nextPaymentDate ? days(r.nextPaymentDate) : "—"}</span>
                      {overdue && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                          Ödemesi geçti
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => setEditing(r)}
                      className="rounded-lg border p-2 text-slate-500 hover:text-[#CD0B16]"
                      aria-label="Düzenle"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="p-12 text-center text-sm text-slate-400">
            Henüz sunucu takip kaydı yok.
          </div>
        )}
      </div>
      {editing && (
        <Dialog
          row={editing === "new" ? undefined : editing}
          clients={clients}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
function Dialog({
  row,
  clients,
  onClose,
}: {
  row?: HostingRow;
  clients: Client[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    saveHostingSubscription,
    null,
  );
  useEffect(() => {
    if (state?.success) {
      onClose();
      router.refresh();
    }
  }, [state?.success, onClose, router]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white">
        <header className="flex justify-between border-b p-5">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Server size={20} />
            {row ? "Sunucu kaydını düzenle" : "Sunucu müşterisi ekle"}
          </h2>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <form action={action} className="grid gap-4 p-5 sm:grid-cols-2">
          {row && <input type="hidden" name="subscription_id" value={row.id} />}
          <Field label="Site / domain">
            <input
              name="domain"
              defaultValue={row?.domain}
              required
              className={inputClass}
            />
          </Field>
          <Field label="CRM müşterisi (opsiyonel)">
            <select
              name="client_id"
              defaultValue={row?.clientId || ""}
              className={inputClass}
            >
              <option value="">Müşteriye bağlı değil</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bağlı hesap / kişi">
            <input
              name="account_label"
              defaultValue={row?.accountLabel || ""}
              className={inputClass}
              placeholder="CRM'de yoksa yazın"
            />
          </Field>
          <Field label="Durum">
            <select
              name="status"
              defaultValue={row?.status || "active"}
              className={inputClass}
            >
              <option value="active">Etkin</option>
              <option value="inactive">Pasif</option>
            </select>
          </Field>
          <Field label="Kurulum tarihi">
            <input
              name="installation_date"
              type="date"
              defaultValue={row?.installationDate || ""}
              className={inputClass}
            />
          </Field>
          <Field label="Sonraki ödeme tarihi">
            <input
              name="next_payment_date"
              type="date"
              defaultValue={row?.nextPaymentDate || ""}
              className={inputClass}
            />
          </Field>
          <Field label="Yenileme dönemi (ay)">
            <input
              name="renewal_months"
              type="number"
              min="1"
              defaultValue={row?.renewalMonths || 12}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Yenileme ücreti">
            <input
              name="fee"
              type="number"
              min="0"
              step="0.01"
              defaultValue={row?.fee || 0}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Para birimi">
            <select
              name="currency"
              defaultValue={row?.currency || "TRY"}
              className={inputClass}
            >
              {["TRY", "USD", "EUR", "GBP"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 pt-7 text-sm">
            <input
              name="is_paid"
              type="checkbox"
              defaultChecked={row?.isPaid ?? true}
            />
            Ücretli sunucu hizmeti
          </label>
          <Field label="Not" className="sm:col-span-2">
            <textarea
              name="notes"
              defaultValue={row?.notes || ""}
              className={inputClass}
            />
          </Field>
          {state?.error && (
            <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Vazgeç
            </Button>
            <Button disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
function days(value: string | null) {
  if (!value) return 9999;
  return Math.ceil(
    (new Date(`${value}T00:00:00`).getTime() - Date.now()) / 86400000,
  );
}
function date(v: string | null) {
  return v
    ? new Intl.DateTimeFormat("tr-TR").format(new Date(`${v}T00:00:00`))
    : "—";
}
