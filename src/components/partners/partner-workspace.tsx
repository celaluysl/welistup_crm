"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil, Plus, X } from "lucide-react";
import {
  createPartnerOwnership,
  updatePartnerOwnership,
} from "@/lib/actions/payroll";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";

export type PartnerOwnership = {
  id: string;
  profileId: string;
  name: string;
  percent: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

type Profile = { id: string; name: string };

export function PartnerWorkspace({
  rows,
  profiles,
}: {
  rows: PartnerOwnership[];
  profiles: Profile[];
}) {
  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; row: PartnerOwnership } | null
  >(null);
  const today = new Date().toISOString().slice(0, 10);
  const activeRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.effectiveFrom <= today &&
          (!row.effectiveTo || row.effectiveTo >= today),
      ),
    [rows, today],
  );
  const activeTotal = activeRows.reduce((sum, row) => sum + row.percent, 0);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">Güncel ortaklık dağılımı</div>
          <div
            className={`mt-1 text-lg font-bold ${Math.abs(activeTotal - 100) < 0.01 ? "text-emerald-700" : "text-amber-700"}`}
          >
            Toplam %{formatPercent(activeTotal)}
          </div>
        </div>
        <Button onClick={() => setDialog({ mode: "create" })}>
          <Plus size={16} /> Yeni ortaklık dönemi
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => {
          const isActive = activeRows.some((active) => active.id === row.id);
          return (
            <Card key={row.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-900">{row.name}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isActive ? "Aktif" : "Geçmiş dönem"}
                    </span>
                  </div>
                  <div className="mt-4 text-3xl font-bold text-[#CD0B16]">
                    %{formatPercent(row.percent)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDialog({ mode: "edit", row })}
                  aria-label={`${row.name} ortaklık oranını düzenle`}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-[#CD0B16]"
                >
                  <Pencil size={16} />
                </button>
              </div>
              <div className="mt-5 flex items-center gap-2 border-t pt-4 text-sm text-slate-500">
                <CalendarDays size={15} />
                <span>
                  {formatDate(row.effectiveFrom)} –{" "}
                  {row.effectiveTo
                    ? formatDate(row.effectiveTo)
                    : "Devam ediyor"}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {!rows.length && (
        <Card className="p-12 text-center text-sm text-slate-400">
          Henüz ortaklık oranı tanımlanmadı.
        </Card>
      )}

      {dialog && (
        <OwnershipDialog
          mode={dialog.mode}
          row={dialog.mode === "edit" ? dialog.row : undefined}
          profiles={profiles}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

function OwnershipDialog({
  mode,
  row,
  profiles,
  onClose,
}: {
  mode: "create" | "edit";
  row?: PartnerOwnership;
  profiles: Profile[];
  onClose: () => void;
}) {
  const action =
    mode === "create" ? createPartnerOwnership : updatePartnerOwnership;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state?.success, onClose]);

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
        aria-labelledby="ownership-dialog-title"
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b p-5">
          <div>
            <h2 id="ownership-dialog-title" className="text-xl font-bold">
              {mode === "create"
                ? "Yeni ortaklık dönemi"
                : "Ortaklık dönemini düzenle"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Oranlar aynı tarihte toplam %100 olmalıdır.
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

        <form action={formAction} className="grid gap-4 p-5 sm:grid-cols-2">
          {mode === "edit" && row && (
            <input type="hidden" name="ownership_id" value={row.id} />
          )}
          {mode === "create" ? (
            <Field label="Ortak">
              <select name="profile_id" required className={inputClass}>
                <option value="">Seçin</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Ortak">
              <input value={row?.name || ""} disabled className={inputClass} />
            </Field>
          )}
          <Field label="Ortaklık oranı (%)">
            <input
              name="ownership_percent"
              type="number"
              min="0.0001"
              max="100"
              step="0.0001"
              defaultValue={row?.percent ?? 33.3333}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Geçerlilik başlangıcı">
            <input
              name="effective_from"
              type="date"
              defaultValue={row?.effectiveFrom}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Geçerlilik sonu">
            <input
              name="effective_to"
              type="date"
              defaultValue={row?.effectiveTo || ""}
              className={inputClass}
            />
          </Field>
          {state?.error && (
            <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Vazgeç
            </Button>
            <Button disabled={pending}>
              {pending
                ? "Kaydediliyor…"
                : mode === "create"
                  ? "Dönemi kaydet"
                  : "Değişiklikleri kaydet"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR").format(new Date(`${value}T00:00:00`));
}
