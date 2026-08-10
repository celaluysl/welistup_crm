"use client";
import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import {
  VendorAssignmentForm,
  type VendorAssignment,
  type VendorServiceOption,
} from "@/components/forms/vendor-assignment-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export type VendorAssignmentRow = VendorAssignment & {
  project_label: string;
  service_name: string;
};
const modelLabels: Record<string, string> = {
  monthly_fixed: "Aylık sabit",
  monthly_variable: "Aylık değişken",
  one_time: "Tek seferlik",
};

export function VendorAssignmentsWorkspace({
  vendorId,
  assignments,
  services,
}: {
  vendorId: string;
  assignments: VendorAssignmentRow[];
  services: VendorServiceOption[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VendorAssignmentRow | null>(null);
  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Proje hizmeti atamaları</h2>
            <p className="mt-1 text-xs text-slate-500">
              Aktif ve tamamlanan çalışma anlaşmalarını yönetin.
            </p>
          </div>
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus size={16} /> Yeni atama
          </Button>
        </div>
        <div className="divide-y">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className={`flex items-center justify-between gap-4 px-5 py-4 ${assignment.status !== "active" ? "bg-slate-50 opacity-70" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {assignment.project_label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold ${assignment.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}
                  >
                    {assignment.status === "active" ? "Aktif" : "Pasif"}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {assignment.service_name} ·{" "}
                  {modelLabels[assignment.payment_model]}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    {assignment.payment_model === "monthly_variable"
                      ? "Tutar ay sonunda girilecek"
                      : `${formatMoney(assignment.default_amount, assignment.currency)} net`}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    {assignment.billing_preference === "invoiced"
                      ? `Faturalı · KDV %${assignment.vat_rate}`
                      : "Faturasız"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    Ayın {assignment.payment_day}. günü
                  </span>
                  {assignment.end_date && (
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      Bitiş: {assignment.end_date}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(assignment)}
                aria-label="Atamayı düzenle"
                title="Düzenle"
                className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-[#CD0B16]"
              >
                <Pencil size={16} />
              </button>
            </div>
          ))}
          {!assignments.length && (
            <div className="p-10 text-center text-sm text-slate-400">
              Henüz atama yok.
            </div>
          )}
        </div>
      </Card>
      {creating && (
        <AssignmentDialog
          title="Yeni proje ataması"
          subtitle="Tedarikçiyi bir proje hizmetine bağlayın."
          onClose={() => setCreating(false)}
        >
          <VendorAssignmentForm
            vendorId={vendorId}
            services={services}
            onSuccess={() => setCreating(false)}
          />
        </AssignmentDialog>
      )}
      {editing && (
        <AssignmentDialog
          title="Atamayı düzenle"
          subtitle={`${editing.project_label} · ${editing.service_name}`}
          onClose={() => setEditing(null)}
        >
          <VendorAssignmentForm
            vendorId={vendorId}
            services={services}
            assignment={editing}
            onSuccess={() => setEditing(null)}
          />
        </AssignmentDialog>
      )}
    </>
  );
}

function AssignmentDialog({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
        aria-labelledby="vendor-assignment-dialog-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b bg-white px-6 py-5">
          <div>
            <h2
              id="vendor-assignment-dialog-title"
              className="text-xl font-bold"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </section>
    </div>
  );
}
