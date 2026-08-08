"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { createOffer } from "@/lib/actions/offers";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { formatMoney } from "@/lib/utils";

type OfferItem = {
  service_id: string;
  custom_service_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_rate: number;
  vat_rate: number;
};

type Values = {
  client_id: string;
  lead_id: string;
  offer_date: string;
  valid_until: string;
  sales_owner_id: string;
  currency: "TRY" | "USD" | "EUR" | "GBP";
  description: string;
  payment_terms: string;
  notes: string;
  items: OfferItem[];
};

const emptyItem: OfferItem = {
  service_id: "",
  custom_service_name: "",
  description: "",
  quantity: 1,
  unit_price: 0,
  discount_rate: 0,
  vat_rate: 20,
};

export function OfferForm({
  clients,
  leads,
  services,
  profiles,
}: {
  clients: { id: string; company_name: string }[];
  leads: { id: string; company_name: string }[];
  services: { id: string; name: string }[];
  profiles: { id: string; first_name: string; last_name: string; email: string }[];
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const { register, control, handleSubmit, watch, setValue } = useForm<Values>({
    defaultValues: {
      client_id: "",
      lead_id: "",
      offer_date: new Date().toISOString().slice(0, 10),
      valid_until: "",
      sales_owner_id: "",
      currency: "TRY",
      description: "",
      payment_terms: "",
      notes: "",
      items: [{ ...emptyItem }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  // React Hook Form intentionally exposes a subscription-based watch API.
  // eslint-disable-next-line react-hooks/incompatible-library
  const values = watch();
  const total = values.items.reduce((sum, item) => {
    const net =
      Number(item.quantity || 0) *
      Number(item.unit_price || 0) *
      (1 - Number(item.discount_rate || 0) / 100);
    return sum + net * (1 + Number(item.vat_rate || 0) / 100);
  }, 0);

  function serviceName(serviceId: string) {
    return services.find((service) => service.id === serviceId)?.name || "";
  }

  function isOther(serviceId: string) {
    return serviceName(serviceId).trim().toLocaleLowerCase("tr-TR") === "diğer";
  }

  return (
    <form
      onSubmit={handleSubmit((value) =>
        start(async () => {
          const result = await createOffer(value);
          if (result?.error) setError(result.error);
        }),
      )}
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Müşteri">
          <select {...register("client_id")} className={inputClass}>
            <option value="">Seçin</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.company_name}</option>
            ))}
          </select>
        </Field>
        <Field label="Lead">
          <select {...register("lead_id")} className={inputClass}>
            <option value="">Seçin</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>{lead.company_name}</option>
            ))}
          </select>
        </Field>
        <Field label="Teklif tarihi"><input type="date" {...register("offer_date")} className={inputClass} /></Field>
        <Field label="Geçerlilik tarihi"><input type="date" {...register("valid_until")} className={inputClass} /></Field>
        <Field label="Satış sorumlusu">
          <select {...register("sales_owner_id")} className={inputClass}>
            <option value="">Atanmadı</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{`${profile.first_name} ${profile.last_name}`.trim() || profile.email}</option>
            ))}
          </select>
        </Field>
        <Field label="Para birimi">
          <select {...register("currency")} className={inputClass}>
            {(["TRY", "USD", "EUR", "GBP"] as const).map((currency) => <option key={currency}>{currency}</option>)}
          </select>
        </Field>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Teklif satırları</h2>
            <p className="mt-1 text-xs text-slate-500">Hizmeti, fiyatı ve vergilendirme detaylarını satır bazında girin.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => append({ ...emptyItem })}>
            <Plus size={16} /> Satır ekle
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const selectedServiceId = values.items[index]?.service_id || "";
            const customService = isOther(selectedServiceId);
            const serviceRegistration = register(`items.${index}.service_id`);
            return (
              <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className={`grid items-end gap-3 ${customService ? "lg:grid-cols-[190px_minmax(180px,0.8fr)_minmax(240px,1.2fr)_90px_140px_110px_100px_40px]" : "lg:grid-cols-[190px_minmax(240px,1fr)_90px_140px_110px_100px_40px]"}`}>
                  <Field label="Hizmet">
                    <select
                      {...serviceRegistration}
                      onChange={(event) => {
                        serviceRegistration.onChange(event);
                        const nextId = event.target.value;
                        const previousName = serviceName(selectedServiceId);
                        const currentDescription = values.items[index]?.description || "";
                        if (!isOther(nextId)) {
                          const nextName = serviceName(nextId);
                          if (!currentDescription || currentDescription === previousName) setValue(`items.${index}.description`, nextName);
                          setValue(`items.${index}.custom_service_name`, "");
                        }
                      }}
                      className={inputClass}
                    >
                      <option value="">Hizmet seçin</option>
                      {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                    </select>
                  </Field>
                  {customService && <Field label="Tek seferlik hizmet adı">
                    <input
                      required
                      placeholder="Örn. Kurumsal sunum tasarımı"
                      {...register(`items.${index}.custom_service_name`)}
                      className={inputClass}
                    />
                  </Field>}
                  <Field label="Hizmet açıklaması">
                    <input
                      required
                      placeholder="Yapılacak işin kapsamını ve detaylarını yazın"
                      {...register(`items.${index}.description`)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Adet"><input type="number" min="0.01" step="0.01" {...register(`items.${index}.quantity`, { valueAsNumber: true })} className={inputClass} /></Field>
                  <Field label="Birim fiyat"><input type="number" min="0" step="0.01" {...register(`items.${index}.unit_price`, { valueAsNumber: true })} className={inputClass} /></Field>
                  <Field label="İndirim (%)"><input type="number" min="0" max="100" step="0.01" {...register(`items.${index}.discount_rate`, { valueAsNumber: true })} className={inputClass} /></Field>
                  <Field label="KDV (%)"><input type="number" min="0" max="100" step="0.01" {...register(`items.${index}.vat_rate`, { valueAsNumber: true })} className={inputClass} /></Field>
                  <button type="button" aria-label="Teklif satırını sil" onClick={() => remove(index)} className="flex size-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50">
                    <Trash2 size={17} />
                  </button>
                </div>
                {customService && <p className="mt-2 text-xs text-amber-700">Bu ad yalnızca bu teklif satırında kullanılacak; hizmet kataloğuna eklenmeyecek.</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Açıklama"><textarea rows={3} {...register("description")} className={`${inputClass} h-auto py-2`} /></Field>
        <Field label="Ödeme koşulları"><textarea rows={3} {...register("payment_terms")} className={`${inputClass} h-auto py-2`} /></Field>
        <Field label="Notlar" className="sm:col-span-2"><textarea rows={3} {...register("notes")} className={`${inputClass} h-auto py-2`} /></Field>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between border-t pt-5">
        <div><div className="text-xs text-slate-400">Tahmini toplam</div><div className="text-2xl font-bold">{formatMoney(total, values.currency)}</div></div>
        <Button disabled={pending}>{pending ? "Oluşturuluyor…" : "Teklifi oluştur"}</Button>
      </div>
    </form>
  );
}
