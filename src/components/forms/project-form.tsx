"use client";
import { useActionState, useState } from "react";
import { createProject } from "@/lib/actions/core";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { ProjectServiceRows } from "@/components/forms/project-service-rows";
export function ProjectForm({
  clients,
  services,
  specialists,
  vendors,
  initialClientId,
}: {
  clients: { id: string; company_name: string }[];
  services: {
    id: string;
    name: string;
    default_periodicity: "monthly" | "variable_monthly" | "one_time" | "periodic";
  }[];
  specialists: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  }[];
  vendors: { id: string; name: string }[];
  initialClientId?: string;
}) {
  const [state, action, pending] = useActionState(createProject, null);
  const [billingPreference, setBillingPreference] = useState<
    "invoiced" | "uninvoiced"
  >("invoiced");
  const [vendorId, setVendorId] = useState("");
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <Field label="Müşteri" className="sm:col-span-2">
        <select
          name="client_id"
          defaultValue={initialClientId || ""}
          required
          className={inputClass}
        >
          <option value="">Seçin</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Proje adı">
        <input name="name" required className={inputClass} />
      </Field>
      <Field label="Domain">
        <input name="domain" placeholder="example.com" className={inputClass} />
      </Field>
      <Field label="Başlangıç tarihi">
        <input type="date" name="start_date" required className={inputClass} />
      </Field>
      <Field label="Proje uzmanı">
        <select
          name="specialist_id"
          required
          defaultValue=""
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
      />
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 sm:col-span-2">
        <div className="mb-4">
          <h3 className="font-semibold text-blue-950">Tedarikçi hakedişi</h3>
          <p className="mt-1 text-xs text-blue-700">
            Projeyi yapan dış uzmanı seçerseniz müşteri ücreti gelir olarak,
            buradaki tutar ise ayrı gider olarak hesaplanır. Bu seçim müşterinin
            tedarikçiye doğrudan ödeme yaptığı anlamına gelmez.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Dış uzman / tedarikçi" className="xl:col-span-2">
            <select
              name="vendor_id"
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
              className={inputClass}
            >
              <option value="">Tedarikçi hakedişi yok</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Aylık net hakediş">
            <input
              name="vendor_default_amount"
              type="number"
              min="0"
              step="0.01"
              required={Boolean(vendorId)}
              disabled={!vendorId}
              placeholder="Örn. 15000"
              className={`${inputClass} disabled:bg-slate-100`}
            />
          </Field>
          <Field label="Hakediş ödeme günü">
            <input
              name="vendor_payment_day"
              type="number"
              min="1"
              max="31"
              defaultValue={28}
              required={Boolean(vendorId)}
              disabled={!vendorId}
              className={`${inputClass} disabled:bg-slate-100`}
            />
          </Field>
        </div>
        <input type="hidden" name="vendor_billing_preference" value="invoiced" />
        <input type="hidden" name="vendor_vat_rate" value="0" />
      </div>
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
        <input type="checkbox" name="is_white_label" />
        White-label / ajans işi
      </label>
      <Field label="Açıklama" className="sm:col-span-2">
        <textarea
          name="description"
          rows={4}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      {state?.error && (
        <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>
      )}
      <div className="sm:col-span-2 flex justify-end">
        <Button disabled={pending}>Projeyi kaydet</Button>
      </div>
    </form>
  );
}
