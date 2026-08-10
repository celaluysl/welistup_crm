"use client";
import { useActionState, useEffect, useState } from "react";
import {
  createVendorAssignment,
  updateVendorAssignment,
} from "@/lib/actions/vendors";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

export type VendorServiceOption = {
  id: string;
  label: string;
  currency: string;
};
export type VendorAssignment = {
  id: string;
  project_service_id: string;
  start_date: string;
  end_date: string | null;
  default_amount: number;
  currency: string;
  payment_model: string;
  billing_preference: string;
  vat_rate: number;
  payment_day: number;
  status: string;
  notes: string | null;
};

export function VendorAssignmentForm({
  vendorId,
  services,
  assignment,
  onSuccess,
}: {
  vendorId: string;
  services: VendorServiceOption[];
  assignment?: VendorAssignment;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(
    assignment ? updateVendorAssignment : createVendorAssignment,
    null,
  );
  const [paymentModel, setPaymentModel] = useState(
    assignment?.payment_model || "monthly_fixed",
  );
  const [billing, setBilling] = useState(
    assignment?.billing_preference || "uninvoiced",
  );
  useEffect(() => {
    if (state?.success) onSuccess?.();
  }, [state?.success, onSuccess]);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="vendor_id" value={vendorId} />
      {assignment && (
        <input type="hidden" name="assignment_id" value={assignment.id} />
      )}
      <Field label="Proje hizmeti" className="sm:col-span-2">
        <select
          name="project_service_id"
          required
          defaultValue={assignment?.project_service_id || ""}
          disabled={Boolean(assignment)}
          className={`${inputClass} disabled:bg-slate-100`}
        >
          <option value="">Seçin</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.label}
            </option>
          ))}
        </select>
        {assignment && (
          <input
            type="hidden"
            name="project_service_id"
            value={assignment.project_service_id}
          />
        )}
      </Field>
      <Field label="Başlangıç">
        <input
          name="start_date"
          type="date"
          required
          defaultValue={
            assignment?.start_date || new Date().toISOString().slice(0, 10)
          }
          className={inputClass}
        />
      </Field>
      <Field label="Bitiş">
        <input
          name="end_date"
          type="date"
          defaultValue={assignment?.end_date || ""}
          className={inputClass}
        />
      </Field>
      <Field label="Ödeme modeli">
        <select
          name="payment_model"
          value={paymentModel}
          onChange={(event) => setPaymentModel(event.target.value)}
          className={inputClass}
        >
          <option value="monthly_fixed">Aylık sabit</option>
          <option value="monthly_variable">Aylık değişken</option>
          <option value="one_time">Tek seferlik</option>
        </select>
      </Field>
      <Field
        label={
          paymentModel === "monthly_variable"
            ? "Başlangıç tahmini (opsiyonel)"
            : "Net hakediş"
        }
      >
        <input
          name="default_amount"
          type="number"
          min="0"
          step="0.01"
          required={paymentModel !== "monthly_variable"}
          defaultValue={assignment?.default_amount ?? 0}
          className={inputClass}
        />
      </Field>
      <Field label="Ödeme şekli">
        <select
          name="billing_preference"
          value={billing}
          onChange={(event) => setBilling(event.target.value)}
          className={inputClass}
        >
          <option value="uninvoiced">Faturasız</option>
          <option value="invoiced">Faturalı</option>
        </select>
      </Field>
      <Field label="KDV (%)">
        <input
          name="vat_rate"
          type="number"
          min="0"
          max="100"
          step="0.01"
          defaultValue={assignment?.vat_rate ?? 20}
          disabled={billing !== "invoiced"}
          className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
        />
        {billing !== "invoiced" && (
          <input type="hidden" name="vat_rate" value="0" />
        )}
      </Field>
      <Field label="Ödeme günü">
        <input
          name="payment_day"
          type="number"
          min="1"
          max="31"
          defaultValue={assignment?.payment_day ?? 28}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Para birimi">
        <select
          name="currency"
          defaultValue={assignment?.currency || "TRY"}
          className={inputClass}
        >
          {["TRY", "USD", "EUR", "GBP"].map((currency) => (
            <option key={currency}>{currency}</option>
          ))}
        </select>
      </Field>
      {assignment && (
        <Field label="Durum">
          <select
            name="status"
            defaultValue={assignment.status}
            className={inputClass}
          >
            <option value="active">Aktif</option>
            <option value="inactive">Pasif / Askıda</option>
          </select>
        </Field>
      )}
      <Field label="Not" className="sm:col-span-2">
        <textarea
          name="notes"
          rows={2}
          defaultValue={assignment?.notes || ""}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      {state?.success && (
        <p className="sm:col-span-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      {state?.error && (
        <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>
      )}
      <div className="sm:col-span-2 flex justify-end">
        <Button disabled={pending}>
          {pending
            ? "Kaydediliyor…"
            : assignment
              ? "Atamayı güncelle"
              : "Hizmete ata"}
        </Button>
      </div>
    </form>
  );
}
