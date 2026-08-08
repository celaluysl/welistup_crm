"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { createOfferRevision } from "@/lib/actions/offers";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

type Item = { service_id: string; custom_service_name: string | null; description: string; quantity: number; unit_price: number; discount_rate: number; vat_rate: number };
type Values = { offer_id: string; description: string; payment_terms: string; notes: string; items: Item[] };

export function OfferRevisionForm({ offerId, revision, services }: { offerId: string; revision: { description: string | null; payment_terms: string | null; notes: string | null; items: Item[] }; services: { id: string; name: string }[] }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const { register, control, handleSubmit, watch, setValue } = useForm<Values>({ defaultValues: { offer_id: offerId, description: revision.description || "", payment_terms: revision.payment_terms || "", notes: revision.notes || "", items: revision.items } });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  // eslint-disable-next-line react-hooks/incompatible-library
  const items = watch("items");
  const serviceName = (id: string) => services.find((service) => service.id === id)?.name || "";
  const isOther = (id: string) => serviceName(id).trim().toLocaleLowerCase("tr-TR") === "diğer";

  return <form onSubmit={handleSubmit((value) => start(async () => { const result = await createOfferRevision(value); if (result?.error) setError(result.error); }))} className="space-y-5">
    <input type="hidden" {...register("offer_id")} />
    <div className="space-y-3">
      {fields.map((field, index) => {
        const selectedId = items[index]?.service_id || "";
        const custom = isOther(selectedId);
        const serviceRegistration = register(`items.${index}.service_id`);
        return <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className={`grid items-end gap-3 ${custom ? "lg:grid-cols-[190px_minmax(180px,.8fr)_minmax(240px,1.2fr)_90px_140px_110px_100px_40px]" : "lg:grid-cols-[190px_minmax(240px,1fr)_90px_140px_110px_100px_40px]"}`}>
            <Field label="Hizmet"><select {...serviceRegistration} onChange={(event) => { serviceRegistration.onChange(event); if (!isOther(event.target.value)) setValue(`items.${index}.custom_service_name`, ""); }} className={inputClass}><option value="">Hizmet seçin</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
            {custom && <Field label="Tek seferlik hizmet adı"><input required {...register(`items.${index}.custom_service_name`)} className={inputClass} /></Field>}
            <Field label="Hizmet açıklaması"><input required {...register(`items.${index}.description`)} className={inputClass} /></Field>
            <Field label="Adet"><input type="number" min="0.01" step=".01" {...register(`items.${index}.quantity`, { valueAsNumber: true })} className={inputClass} /></Field>
            <Field label="Birim fiyat"><input type="number" min="0" step=".01" {...register(`items.${index}.unit_price`, { valueAsNumber: true })} className={inputClass} /></Field>
            <Field label="İndirim (%)"><input type="number" min="0" max="100" step=".01" {...register(`items.${index}.discount_rate`, { valueAsNumber: true })} className={inputClass} /></Field>
            <Field label="KDV (%)"><input type="number" min="0" max="100" step=".01" {...register(`items.${index}.vat_rate`, { valueAsNumber: true })} className={inputClass} /></Field>
            <button type="button" aria-label="Teklif satırını sil" onClick={() => remove(index)} className="flex size-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={17} /></button>
          </div>
        </div>;
      })}
    </div>
    <Button type="button" variant="secondary" onClick={() => append({ service_id: "", custom_service_name: "", description: "", quantity: 1, unit_price: 0, discount_rate: 0, vat_rate: 20 })}><Plus size={16} /> Satır ekle</Button>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Açıklama"><textarea rows={3} {...register("description")} className={`${inputClass} h-auto py-2`} /></Field><Field label="Ödeme koşulları"><textarea rows={3} {...register("payment_terms")} className={`${inputClass} h-auto py-2`} /></Field><Field label="Notlar" className="sm:col-span-2"><textarea rows={3} {...register("notes")} className={`${inputClass} h-auto py-2`} /></Field></div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="flex justify-end"><Button disabled={pending}>{pending ? "Kaydediliyor…" : "Yeni revizyonu kaydet"}</Button></div>
  </form>;
}
