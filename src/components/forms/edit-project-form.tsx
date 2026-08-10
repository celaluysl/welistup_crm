"use client";
import { useActionState, useState } from "react";
import { updateProject } from "@/lib/actions/core";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { ProjectServiceRows } from "@/components/forms/project-service-rows";
type Project = {
  id: string;
  client_id: string;
  name: string;
  domain: string | null;
  description: string | null;
  start_date: string | null;
  billing_preference: "invoiced" | "uninvoiced";
  is_white_label: boolean;
  project_services: {
    id: string;
    service_id: string;
    periodicity: "monthly" | "variable_monthly" | "one_time" | "periodic";
    currency: "TRY" | "USD" | "EUR" | "GBP";
    payment_term_days: number;
    payment_interval_months: number;
    payment_timing: "advance" | "arrears";
    notes: string | null;
    status: string;
    services: { name: string } | { name: string }[] | null;
    project_service_members: { profile_id: string }[];
    project_service_prices: {
      net_price: number;
      vat_rate: number;
      currency: "TRY" | "USD" | "EUR" | "GBP";
      effective_from: string;
      effective_to: string | null;
    }[];
  }[];
};
export function EditProjectForm({
  project,
  clients,
  services,
  specialists,
}: {
  project: Project;
  clients: { id: string; company_name: string }[];
  services: {
    id: string;
    name: string;
    default_periodicity:
      "monthly" | "variable_monthly" | "one_time" | "periodic";
  }[];
  specialists: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  }[];
}) {
  const [state, action, pending] = useActionState(updateProject, null);
  const [billingPreference, setBillingPreference] = useState(
    project.billing_preference,
  );
  const activeService =
    project.project_services.find((item) => item.status === "active") ||
    project.project_services[0];
  const currentPrice = activeService
    ? [...activeService.project_service_prices]
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
        .find((price) => !price.effective_to) ||
      [...activeService.project_service_prices].sort((a, b) =>
        b.effective_from.localeCompare(a.effective_from),
      )[0]
    : undefined;
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="id" value={project.id} />
      <Field label="Müşteri" className="sm:col-span-2">
        <select
          name="client_id"
          defaultValue={project.client_id}
          required
          className={inputClass}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Proje adı">
        <input
          name="name"
          defaultValue={project.name}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Domain">
        <input
          name="domain"
          defaultValue={project.domain || ""}
          className={inputClass}
        />
      </Field>
      <Field label="Başlangıç tarihi">
        <input
          type="date"
          name="start_date"
          defaultValue={project.start_date || ""}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Proje uzmanı">
        <select
          name="specialist_id"
          required
          defaultValue={
            activeService?.project_service_members[0]?.profile_id || ""
          }
          className={inputClass}
        >
          <option value="">Uzman seçin</option>
          {specialists.map((specialist) => (
            <option key={specialist.id} value={specialist.id}>
              {`${specialist.first_name} ${specialist.last_name}`.trim() ||
                specialist.email}
            </option>
          ))}
        </select>
      </Field>
      <ProjectServiceRows
        services={services}
        isUninvoiced={billingPreference === "uninvoiced"}
        initialService={
          activeService
            ? {
                service_id: activeService.service_id,
                periodicity: activeService.periodicity,
                net_price: currentPrice?.net_price || 0,
                vat_rate: currentPrice?.vat_rate ?? 20,
                currency: currentPrice?.currency || activeService.currency,
                payment_term_days: activeService.payment_term_days,
                payment_interval_months: activeService.payment_interval_months,
                payment_timing: activeService.payment_timing,
                notes: activeService.notes,
              }
            : undefined
        }
      />
      <Field label="Faturalama tercihi">
        <select
          name="billing_preference"
          value={billingPreference}
          onChange={(event) =>
            setBillingPreference(
              event.target.value as "invoiced" | "uninvoiced",
            )
          }
          className={inputClass}
        >
          <option value="invoiced">Faturalı</option>
          <option value="uninvoiced">Faturasız</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 pt-7 text-sm">
        <input
          type="checkbox"
          name="is_white_label"
          defaultChecked={project.is_white_label}
        />
        White-label / ajans işi
      </label>
      <Field label="Açıklama" className="sm:col-span-2">
        <textarea
          name="description"
          defaultValue={project.description || ""}
          rows={4}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      {state?.error && (
        <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>
      )}
      <div className="sm:col-span-2 flex justify-end">
        <Button disabled={pending}>
          {pending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
        </Button>
      </div>
    </form>
  );
}
